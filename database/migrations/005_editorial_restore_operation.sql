ALTER TABLE editorial_submissions
    MODIFY COLUMN operation ENUM('create', 'update', 'restore') NOT NULL;
