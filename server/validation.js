"use strict";

const { z } = require("zod");
const { AppError } = require("./errors");

const cleanShortText = (maximum) => z.string().trim().max(maximum);
const publicationStatus = z.enum(["draft", "review", "published"]);
const uidSchema = z.string().trim().min(3).max(180).regex(/^[a-zA-Z0-9:_-]+$/);
const productSlugSchema = z.string().trim().min(2).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const articleSlugSchema = z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const strongPasswordSchema = z.string().min(12).max(72).superRefine((value, context) => {
    if (value.trim().length < 12) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Use pelo menos 12 caracteres que não sejam espaços." });
    }
    if (Buffer.byteLength(value, "utf8") > 72) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "A senha deve ter no máximo 72 bytes." });
    }
    if (new Set(value).size < 6) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Evite senhas com caracteres muito repetidos." });
    }
});
const editorialAdminSchema = z.object({
    uid: uidSchema.optional(),
    status: publicationStatus.optional().default("draft"),
    visible: z.boolean().optional().default(true),
    version: z.number().int().nonnegative().max(2147483647).optional(),
    submissionId: uidSchema.optional(),
    submissionStatus: z.enum(["draft", "pending", "approved", "rejected", "cancelled"]).optional(),
    reviewNote: cleanShortText(1000).optional(),
    updatedAt: z.string().max(60).optional()
}).passthrough();

function payloadWithinLimit(value) {
    return Buffer.byteLength(JSON.stringify(value), "utf8") <= 512 * 1024;
}

const loginSchema = z.object({
    email: z.string().trim().email().max(190).transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(200),
    remember: z.boolean().optional().default(false)
}).strict();

const mfaChallengeSchema = z.object({
    challengeToken: z.string().min(32).max(200),
    code: z.string().trim().min(6).max(30),
    remember: z.boolean().optional()
}).strict();

const forgotPasswordSchema = z.object({
    email: z.string().trim().email().max(190).transform((value) => value.toLowerCase())
}).strict();

const resetPasswordSchema = z.object({
    token: z.string().min(32).max(200),
    newPassword: strongPasswordSchema
}).strict();

const passwordChangeSchema = z.object({
    currentPassword: z.string().min(8).max(200),
    newPassword: strongPasswordSchema,
    code: z.string().trim().min(6).max(30).optional().default("")
}).strict();

const mfaCodeSchema = z.object({
    code: z.string().trim().min(6).max(30)
}).strict();

const mfaSetupSchema = z.object({
    password: z.string().min(8).max(200)
}).strict();

const mfaDisableSchema = z.object({
    password: z.string().min(8).max(200),
    code: z.string().trim().min(6).max(30)
}).strict();

const staffInvitationSchema = z.object({
    name: cleanShortText(120).min(2),
    email: z.string().trim().email().max(190).transform((value) => value.toLowerCase())
}).strict();

const invitationAcceptSchema = z.object({
    token: z.string().min(32).max(200),
    password: strongPasswordSchema
}).strict();

const staffUpdateSchema = z.object({
    active: z.boolean()
}).strict();

const reviewApprovalSchema = z.object({
    note: cleanShortText(1000).optional().default("")
}).strict();

const reviewRejectionSchema = z.object({
    note: cleanShortText(1000).min(2)
}).strict();

const productSchema = z.object({
    id: productSlugSchema,
    modelo: cleanShortText(160).min(1),
    categoria: cleanShortText(160).optional().default(""),
    _admin: editorialAdminSchema.optional()
}).passthrough().refine(payloadWithinLimit, { message: "O cadastro ultrapassa o limite de 512 KB." });

const productMutationSchema = z.object({
    type: z.enum(["new", "used"]),
    product: productSchema
}).strict();

const publishableProductSchema = productSchema.superRefine((product, context) => {
    const specs = Array.isArray(product.specs) ? product.specs : [];
    const hasValidSpec = specs.some((item) => (
        Array.isArray(item)
        && String(item[0] || "").trim()
        && String(item[1] || "").trim()
    ));
    if (!String(product.categoria || "").trim()) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["categoria"], message: "Informe a categoria antes de publicar." });
    }
    if (!String(product.resumo || "").trim()) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["resumo"], message: "Informe o resumo antes de publicar." });
    }
    if (!String(product.descricao || "").trim()) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["descricao"], message: "Informe a descrição completa antes de publicar." });
    }
    if (!hasValidSpec) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["specs"], message: "Adicione ao menos uma especificação técnica completa." });
    }
});

const articleSchema = z.object({
    slug: articleSlugSchema,
    title: cleanShortText(240).min(3),
    category: cleanShortText(120).optional().default(""),
    author: cleanShortText(120).optional().default("Equipe Brutusmaq"),
    popular: z.boolean().optional().default(false),
    _admin: editorialAdminSchema.optional()
}).passthrough().refine(payloadWithinLimit, { message: "O artigo ultrapassa o limite de 512 KB." });

const publishableArticleSchema = articleSchema.superRefine((article, context) => {
    const intro = Array.isArray(article.intro) ? article.intro.filter((item) => String(item || "").trim()) : [];
    const sections = Array.isArray(article.sections) ? article.sections : [];
    const validSections = sections.length > 0 && sections.every((section) => (
        section && typeof section === "object"
        && String(section.title || "").trim()
        && Array.isArray(section.paragraphs)
        && section.paragraphs.some((paragraph) => String(paragraph || "").trim())
    ));
    const requiredText = [
        ["category", article.category, "Informe a categoria antes de publicar."],
        ["excerpt", article.excerpt, "Informe o resumo antes de publicar."],
        ["datetime", article.datetime, "Informe a data antes de publicar."],
        ["image", article.image, "Adicione uma imagem antes de publicar."],
        ["imageAlt", article.imageAlt, "Informe o texto alternativo da imagem." ]
    ];
    requiredText.forEach(([field, value, message]) => {
        if (!String(value || "").trim()) context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
    });
    if (!intro.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["intro"], message: "Adicione a introdução antes de publicar." });
    }
    if (!validSections) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["sections"], message: "Cada seção precisa de título e ao menos um parágrafo." });
    }
});

const leadSchema = z.object({
    motivo: cleanShortText(120).min(2),
    nome: cleanShortText(160).min(2),
    telefone: cleanShortText(40).refine(
        (value) => {
            const digits = value.replace(/\D/g, "");
            return digits.length >= 10 && digits.length <= 15;
        },
        "Informe um telefone com DDD."
    ),
    email: z.union([z.literal(""), z.string().trim().email().max(190)]).optional().default(""),
    empresa: cleanShortText(190).optional().default(""),
    cidade_estado: cleanShortText(160).optional().default(""),
    interesse: cleanShortText(160).optional().default(""),
    mensagem: cleanShortText(1200).optional().default(""),
    equipamento_solicitado: cleanShortText(180).optional().default(""),
    produto_slug: cleanShortText(140).optional().default(""),
    origem_da_solicitacao: cleanShortText(180).optional().default("contato.html"),
    contexto_do_atendimento: cleanShortText(180).optional().default(""),
    _honey: cleanShortText(200).optional().default("")
}).passthrough();

const analyticsEventSchema = z.object({
    id: cleanShortText(100).min(8),
    type: z.enum([
        "page_view",
        "proposal_intent",
        "whatsapp_click",
        "form_submit_attempt",
        "form_submit_success",
        "form_submit_failure",
        "article_share"
    ]),
    timestamp: z.string().datetime(),
    sessionId: cleanShortText(100).min(8),
    page: cleanShortText(180).min(1),
    entityType: z.enum(["page", "product", "used_product", "article"]).optional().default("page"),
    entityId: cleanShortText(140).optional().default(""),
    entityName: cleanShortText(180).optional().default(""),
    channel: cleanShortText(60).optional().default(""),
    formType: cleanShortText(120).optional().default(""),
    source: cleanShortText(180).optional().default(""),
    deviceType: z.enum(["desktop", "mobile", "tablet", "unknown"]).optional().default("unknown"),
    trafficSource: z.enum([
        "direct", "google", "bing", "facebook", "instagram", "tiktok", "youtube",
        "linkedin", "whatsapp", "email", "other", "unknown"
    ]).optional().default("unknown"),
    trafficMedium: z.enum(["direct", "organic", "social", "paid", "referral", "email", "unknown"]).optional().default("unknown")
}).strict();

const analyticsBatchSchema = z.object({
    consent: z.object({
        version: z.literal("2026-07-17"),
        analytics: z.literal(true)
    }).strict(),
    events: z.array(analyticsEventSchema).min(1).max(50)
}).strict();

const leadStatusSchema = z.object({
    status: z.enum(["new", "in_progress", "closed", "spam"])
}).strict();

function parse(schema, value) {
    const result = schema.safeParse(value);
    if (!result.success) {
        throw new AppError(422, "validation_failed", "Revise os campos informados.", result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message
        })));
    }
    return result.data;
}

module.exports = {
    schemas: {
        login: loginSchema,
        mfaChallenge: mfaChallengeSchema,
        forgotPassword: forgotPasswordSchema,
        resetPassword: resetPasswordSchema,
        passwordChange: passwordChangeSchema,
        mfaCode: mfaCodeSchema,
        mfaSetup: mfaSetupSchema,
        mfaDisable: mfaDisableSchema,
        staffInvitation: staffInvitationSchema,
        invitationAccept: invitationAcceptSchema,
        staffUpdate: staffUpdateSchema,
        reviewApproval: reviewApprovalSchema,
        reviewRejection: reviewRejectionSchema,
        product: productMutationSchema,
        publishableProduct: publishableProductSchema,
        article: articleSchema,
        publishableArticle: publishableArticleSchema,
        lead: leadSchema,
        analyticsBatch: analyticsBatchSchema,
        leadStatus: leadStatusSchema,
        uid: uidSchema
    },
    parse
};
