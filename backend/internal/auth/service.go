package auth

import (
	"context"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailTaken         = errors.New("email already taken")
	ErrInvalidToken       = errors.New("invalid or expired token")
	ErrWrongPassword      = errors.New("wrong current password")
)

type User struct {
	ID    string
	Email string
	Lang  string
	Theme string
}

type Service struct {
	db        *pgxpool.Pool
	rdb       *redis.Client
	jwtSecret []byte
}

func NewService(db *pgxpool.Pool, rdb *redis.Client, jwtSecret string) *Service {
	return &Service{db: db, rdb: rdb, jwtSecret: []byte(jwtSecret)}
}

func (s *Service) Register(ctx context.Context, email, password string) (*User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	var user User
	err = s.db.QueryRow(ctx,
		`INSERT INTO users (email, password_hash) VALUES ($1, $2)
		 RETURNING id::text, email, lang, theme`,
		email, string(hash),
	).Scan(&user.ID, &user.Email, &user.Lang, &user.Theme)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrEmailTaken
		}
		return nil, err
	}
	return &user, nil
}

func (s *Service) Login(ctx context.Context, email, password string) (*User, string, string, error) {
	var user User
	var hash string
	err := s.db.QueryRow(ctx,
		`SELECT id::text, email, password_hash, lang, theme FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Email, &hash, &user.Lang, &user.Theme)
	if err != nil {
		return nil, "", "", ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return nil, "", "", ErrInvalidCredentials
	}

	accessToken, err := s.issueAccessToken(user.ID)
	if err != nil {
		return nil, "", "", err
	}

	refreshToken, err := s.issueRefreshToken(ctx, user.ID)
	if err != nil {
		return nil, "", "", err
	}

	return &user, accessToken, refreshToken, nil
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (string, string, error) {
	userID, err := s.rdb.Get(ctx, "refresh:"+refreshToken).Result()
	if err != nil {
		return "", "", ErrInvalidToken
	}

	s.rdb.Del(ctx, "refresh:"+refreshToken)

	accessToken, err := s.issueAccessToken(userID)
	if err != nil {
		return "", "", err
	}
	newRefresh, err := s.issueRefreshToken(ctx, userID)
	if err != nil {
		return "", "", err
	}
	return accessToken, newRefresh, nil
}

func (s *Service) Logout(ctx context.Context, refreshToken string) {
	s.rdb.Del(ctx, "refresh:"+refreshToken)
}

func (s *Service) GetUser(ctx context.Context, userID string) (*User, error) {
	var user User
	err := s.db.QueryRow(ctx,
		`SELECT id::text, email, lang, theme FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Email, &user.Lang, &user.Theme)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *Service) UpdateUser(ctx context.Context, userID, lang, theme string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE users SET lang = $1, theme = $2 WHERE id = $3`,
		lang, theme, userID,
	)
	return err
}

func (s *Service) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	var hash string
	err := s.db.QueryRow(ctx, `SELECT password_hash FROM users WHERE id = $1`, userID).Scan(&hash)
	if err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(currentPassword)); err != nil {
		return ErrWrongPassword
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `UPDATE users SET password_hash = $1 WHERE id = $2`, string(newHash), userID)
	return err
}

func (s *Service) ValidateAccessToken(tokenStr string) (string, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return "", ErrInvalidToken
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", ErrInvalidToken
	}
	userID, ok := claims["user_id"].(string)
	if !ok {
		return "", ErrInvalidToken
	}
	return userID, nil
}

func (s *Service) issueAccessToken(userID string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(15 * time.Minute).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.jwtSecret)
}

func (s *Service) issueRefreshToken(ctx context.Context, userID string) (string, error) {
	token := uuid.New().String()
	err := s.rdb.Set(ctx, "refresh:"+token, userID, 30*24*time.Hour).Err()
	return token, err
}

func isUniqueViolation(err error) bool {
	return err != nil && (containsStr(err.Error(), "unique") || containsStr(err.Error(), "duplicate"))
}

func containsStr(s, sub string) bool {
	if len(sub) == 0 {
		return true
	}
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
