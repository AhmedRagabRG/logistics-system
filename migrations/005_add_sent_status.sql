-- Migration: Add 'sent' to quotes status enum
ALTER TABLE quotes MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'ready_to_send', 'sent') NOT NULL DEFAULT 'pending';
