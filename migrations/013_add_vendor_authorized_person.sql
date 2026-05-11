-- Add authorized_person_name column to vendors table
ALTER TABLE vendors
  ADD COLUMN authorized_person_name VARCHAR(128) AFTER city;
