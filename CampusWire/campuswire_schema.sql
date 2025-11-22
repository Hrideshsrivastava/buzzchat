DROP DATABASE IF EXISTS campuswire_db;
CREATE DATABASE campuswire_db;
USE campuswire_db;

-- ============================
-- USERS TABLE (Unified)
-- ============================
CREATE TABLE `User` (
  user_id CHAR(5) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE,
  password VARCHAR(255) NOT NULL,
  is_verified TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  dept VARCHAR(50),
  year INT,
  role ENUM('Student','Moderator','Admin') DEFAULT 'Student',
  warning_level ENUM('Green','Orange','Red') DEFAULT 'Green',
  warning_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================
-- POSTS TABLE
-- ============================
CREATE TABLE `Post` (
  post_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(5) NOT NULL,
  content TEXT NOT NULL,
  image_path VARCHAR(255),
  emotion ENUM('Happy','Sad','Angry','Excited','Neutral') DEFAULT 'Neutral',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status ENUM('Active','Flagged','Deleted') DEFAULT 'Active',
  FOREIGN KEY (user_id) REFERENCES `User`(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================
-- REACTION TABLE
-- ============================
CREATE TABLE `Reaction` (
  reaction_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id CHAR(5) NOT NULL,
  type ENUM('Like','Comment','Share') NOT NULL,
  comment_text TEXT,
  reaction_type ENUM('like','love','funny','insightful') DEFAULT 'like',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES `Post`(post_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES `User`(user_id)
) ENGINE=InnoDB;

-- ============================
-- WARNING TABLE
-- ============================
CREATE TABLE `Warning` (
  warning_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(5) NOT NULL,
  reason VARCHAR(255),
  issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES `User`(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================
-- FESTIVAL THEMES
-- ============================
CREATE TABLE `FestivalTheme` (
  theme_id INT AUTO_INCREMENT PRIMARY KEY,
  festival_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  primary_color VARCHAR(20),
  secondary_color VARCHAR(20),
  background_image VARCHAR(255),
  banner_image VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================
-- EMOTION FEED
-- ============================
CREATE TABLE `EmotionFeed` (
  feed_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(5) NOT NULL,
  emotion_preference ENUM('Happy','Sad','Angry','Excited','Neutral') DEFAULT 'Neutral',
  suggested_post_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES `User`(user_id),
  FOREIGN KEY (suggested_post_id) REFERENCES `Post`(post_id)
) ENGINE=InnoDB;

-- ============================
-- REPORT TABLE
-- ============================
CREATE TABLE `Report` (
  report_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  reported_by CHAR(5) NOT NULL,
  reason VARCHAR(255),
  report_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES `Post`(post_id),
  FOREIGN KEY (reported_by) REFERENCES `User`(user_id)
) ENGINE=InnoDB;

-- ============================
-- EMAIL VERIFICATION
-- ============================
CREATE TABLE `EmailVerification` (
  token VARCHAR(128) PRIMARY KEY,
  user_id CHAR(5) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES `User`(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================
-- CHAT SYSTEM (NeonChat Tables)
-- ============================
CREATE TABLE chats (
  chat_id INT AUTO_INCREMENT PRIMARY KEY,
  chat_name VARCHAR(255),
  group_name VARCHAR(255)
);

CREATE TABLE participants (
  chat_id INT,
  user_id CHAR(5),
  PRIMARY KEY(chat_id, user_id),
  FOREIGN KEY(chat_id) REFERENCES chats(chat_id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES `User`(user_id) ON DELETE CASCADE
);

CREATE TABLE texts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  data TEXT NOT NULL,
  chat_id INT NOT NULL,
  user_id CHAR(5) NOT NULL,
  time DATETIME NOT NULL,
  FOREIGN KEY(chat_id) REFERENCES chats(chat_id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES `User`(user_id) ON DELETE CASCADE
);

-- ============================
-- TRIGGERS
-- ============================
DELIMITER $$

CREATE TRIGGER prevent_duplicate_email
BEFORE INSERT ON `User`
FOR EACH ROW
BEGIN
  IF NEW.email IS NOT NULL AND (SELECT COUNT(*) FROM `User` WHERE email = NEW.email) > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Account already exists for this email.';
  END IF;
END$$

CREATE TRIGGER issue_warning_after_flag
AFTER UPDATE ON `Post`
FOR EACH ROW
BEGIN
  IF NEW.status = 'Flagged' AND OLD.status <> 'Flagged' THEN
    INSERT INTO `Warning`(user_id, reason)
    VALUES (NEW.user_id, CONCAT('Post flagged (post_id=', NEW.post_id, ')'));

    UPDATE `User`
    SET warning_count = warning_count + 1,
        warning_level = CASE
          WHEN warning_count + 1 >= 3 THEN 'Red'
          WHEN warning_count + 1 = 2 THEN 'Orange'
          ELSE 'Green'
        END
    WHERE user_id = NEW.user_id;
  END IF;
END$$

CREATE TRIGGER deactivate_user_after_excessive_warnings
AFTER UPDATE ON `User`
FOR EACH ROW
BEGIN
  IF NEW.warning_count >= 5 THEN
    UPDATE `User`
    SET is_active = 0
    WHERE user_id = NEW.user_id;
  END IF;
END$$

DELIMITER ;

-- ============================
-- CHAT STORED PROCEDURES
-- ============================
DELIMITER $$

CREATE PROCEDURE CreateOrGetChat(IN userA CHAR(5), IN userB CHAR(5))
BEGIN
    DECLARE existingChat INT;

    SELECT c.chat_id INTO existingChat
    FROM chats c
    JOIN participants p1 ON c.chat_id = p1.chat_id AND p1.user_id = userA
    JOIN participants p2 ON c.chat_id = p2.chat_id AND p2.user_id = userB
    WHERE c.group_name IS NULL
    LIMIT 1;

    IF existingChat IS NOT NULL THEN
        SELECT existingChat AS chat_id;
    ELSE
        INSERT INTO chats (chat_name, group_name)
        VALUES (CONCAT('pvt_', userA, '_', userB), NULL);

        SET existingChat = LAST_INSERT_ID();

        INSERT INTO participants (chat_id, user_id) VALUES (existingChat, userA);
        INSERT INTO participants (chat_id, user_id) VALUES (existingChat, userB);

        SELECT existingChat AS chat_id;
    END IF;
END$$

CREATE PROCEDURE DeleteMessage(IN msgId INT, IN requesterId CHAR(5))
BEGIN
  DECLARE sender CHAR(5);
  SELECT user_id INTO sender FROM texts WHERE id = msgId;
  IF sender = requesterId THEN
    DELETE FROM texts WHERE id = msgId;
  END IF;
END$$

CREATE PROCEDURE EditMessage(IN msgId INT, IN requesterId CHAR(5), IN newText TEXT)
BEGIN
  DECLARE sender CHAR(5);
  SELECT user_id INTO sender FROM texts WHERE id = msgId;
  IF sender = requesterId THEN
    UPDATE texts SET data = newText, time = NOW() WHERE id = msgId;
  END IF;
END$$

DELIMITER ;

-- ============================
-- SAMPLE DATA
-- ============================
INSERT INTO `User`(user_id, name, email, password, dept, year, role)
VALUES
('ADM01','Admin','admin@mail.jiit.ac.in','hashed_pw_admin','AdminDept',0,'Admin');

INSERT INTO `FestivalTheme`(festival_name, start_date, end_date, primary_color, secondary_color, background_image, banner_image)
VALUES
('Diwali','2025-10-20','2025-10-27','#FFD700','#FF9933','/themes/diwali_bg.png','/themes/diwali_banner.svg'),
('Christmas','2025-12-20','2025-12-26','#B30000','#FFFFFF','/themes/christmas_bg.png','/themes/christmas_banner.svg');
