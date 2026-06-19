package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"time"

	"auth-service/config"
	"auth-service/models"
	"auth-service/telemetry"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

func init() {
	if len(jwtSecret) == 0 {
		jwtSecret = []byte("super_secret_jwt_key_change_me_in_production")
	}
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type Claims struct {
	Email string `json:"email"`
	Role  string `json:"role"`
	Jti   string `json:"jti"`
	jwt.RegisteredClaims
}

func generateJti() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		telemetry.RegistrationsTotal.WithLabelValues("failure").Inc()
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	if req.Email == "" || req.Password == "" {
		telemetry.RegistrationsTotal.WithLabelValues("failure").Inc()
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Email and password are required"})
	}

	// Validate role
	allowedRoles := map[string]bool{
		"admin":               true,
		"warehouse_manager":   true,
		"procurement_manager": true,
		"production_manager":  true,
		"finance_manager":     true,
		"viewer":              true,
	}

	if req.Role == "" {
		req.Role = "viewer"
	}

	if !allowedRoles[req.Role] {
		telemetry.RegistrationsTotal.WithLabelValues("failure").Inc()
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid role"})
	}

	// Check if user already exists
	var existingUser models.User
	if err := config.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		telemetry.RegistrationsTotal.WithLabelValues("conflict").Inc()
		return c.Status(409).JSON(fiber.Map{"error": "Conflict", "message": "Email is already registered"})
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		telemetry.RegistrationsTotal.WithLabelValues("failure").Inc()
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to secure password"})
	}

	newUser := models.User{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Role:         req.Role,
		IsActive:     true,
	}

	if err := config.DB.Create(&newUser).Error; err != nil {
		telemetry.RegistrationsTotal.WithLabelValues("failure").Inc()
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to create user"})
	}

	telemetry.RegistrationsTotal.WithLabelValues("success").Inc()
	return c.Status(201).JSON(fiber.Map{
		"message": "User registered successfully",
		"user": fiber.Map{
			"id":    newUser.ID,
			"email": newUser.Email,
			"role":  newUser.Role,
		},
	})
}

func Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		telemetry.LoginsTotal.WithLabelValues("failure").Inc()
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	var user models.User
	if err := config.DB.Where("email = ? AND is_active = true", req.Email).First(&user).Error; err != nil {
		telemetry.LoginsTotal.WithLabelValues("invalid_credentials").Inc()
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized", "message": "Invalid email or password"})
	}

	// Compare passwords
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		telemetry.LoginsTotal.WithLabelValues("invalid_credentials").Inc()
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized", "message": "Invalid email or password"})
	}

	// Generate JWT Access Token
	accessJti := generateJti()
	accessClaims := Claims{
		Email: user.Email,
		Role:  user.Role,
		Jti:   accessJti,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString(jwtSecret)
	if err != nil {
		telemetry.LoginsTotal.WithLabelValues("failure").Inc()
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to generate tokens"})
	}

	// Generate JWT Refresh Token
	refreshJti := generateJti()
	refreshClaims := Claims{
		Email: user.Email,
		Role:  user.Role,
		Jti:   refreshJti,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString(jwtSecret)
	if err != nil {
		telemetry.LoginsTotal.WithLabelValues("failure").Inc()
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to generate tokens"})
	}

	telemetry.LoginsTotal.WithLabelValues("success").Inc()
	return c.JSON(fiber.Map{
		"access_token":  accessTokenString,
		"refresh_token": refreshTokenString,
		"user": fiber.Map{
			"id":    user.ID,
			"email": user.Email,
			"role":  user.Role,
		},
	})
}

func Refresh(c *fiber.Ctx) error {
	var req RefreshRequest
	if err := c.BodyParser(&req); err != nil {
		telemetry.TokenRefreshesTotal.WithLabelValues("failure").Inc()
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid request payload"})
	}

	token, err := jwt.ParseWithClaims(req.RefreshToken, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		telemetry.TokenRefreshesTotal.WithLabelValues("failure").Inc()
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized", "message": "Invalid or expired refresh token"})
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		telemetry.TokenRefreshesTotal.WithLabelValues("failure").Inc()
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized", "message": "Invalid token claims"})
	}

	// Check if this refresh token Jti is blacklisted
	isBlacklisted, err := config.RedisClient.Exists(context.Background(), "revoked_token:"+claims.Jti).Result()
	if err == nil && isBlacklisted > 0 {
		telemetry.TokenRefreshesTotal.WithLabelValues("revoked").Inc()
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized", "message": "Refresh token has been revoked"})
	}

	// Validate user is still active
	var user models.User
	if err := config.DB.First(&user, "id = ? AND is_active = true", claims.Subject).Error; err != nil {
		telemetry.TokenRefreshesTotal.WithLabelValues("failure").Inc()
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized", "message": "User is no longer active"})
	}

	// Issue new access token
	accessJti := generateJti()
	accessClaims := Claims{
		Email: user.Email,
		Role:  user.Role,
		Jti:   accessJti,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString(jwtSecret)
	if err != nil {
		telemetry.TokenRefreshesTotal.WithLabelValues("failure").Inc()
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to refresh token"})
	}

	telemetry.TokenRefreshesTotal.WithLabelValues("success").Inc()
	return c.JSON(fiber.Map{
		"access_token": accessTokenString,
	})
}

func Logout(c *fiber.Ctx) error {
	// Extract from auth header
	authHeader := c.Get("Authorization")
	if authHeader == "" || len(authHeader) < 8 || authHeader[:7] != "Bearer " {
		return c.Status(400).JSON(fiber.Map{"error": "Bad Request", "message": "Invalid Authorization header"})
	}
	tokenString := authHeader[7:]

	token, _ := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if token != nil {
		if claims, ok := token.Claims.(*Claims); ok {
			expiresAt := claims.ExpiresAt.Time
			timeRemaining := time.Until(expiresAt)
			if timeRemaining > 0 {
				config.RedisClient.Set(context.Background(), "revoked_token:"+claims.Jti, "revoked", timeRemaining)
			}
		}
	}

	// Also parse and revoke refresh token if passed in body
	var req RefreshRequest
	if err := c.BodyParser(&req); err == nil && req.RefreshToken != "" {
		refToken, _ := jwt.ParseWithClaims(req.RefreshToken, &Claims{}, func(t *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})
		if refToken != nil {
			if refClaims, ok := refToken.Claims.(*Claims); ok {
				remTime := time.Until(refClaims.ExpiresAt.Time)
				if remTime > 0 {
					config.RedisClient.Set(context.Background(), "revoked_token:"+refClaims.Jti, "revoked", remTime)
				}
			}
		}
	}

	telemetry.LogoutsTotal.Inc()
	return c.JSON(fiber.Map{"message": "Logged out successfully"})
}

// UserMe exposes user information based on gateway injected header values
func UserMe(c *fiber.Ctx) error {
	userID := c.Get("X-User-Id")
	userEmail := c.Get("X-User-Email")
	userRole := c.Get("X-User-Role")

	if userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	return c.JSON(fiber.Map{
		"id":    userID,
		"email": userEmail,
		"role":  userRole,
	})
}

// GetUsers returns the list of all registered users
func GetUsers(c *fiber.Ctx) error {
	var users []models.User
	if err := config.DB.Find(&users).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Internal Server Error", "message": "Failed to fetch users"})
	}

	var response []fiber.Map
	for _, user := range users {
		response = append(response, fiber.Map{
			"id":         user.ID,
			"email":      user.Email,
			"role":       user.Role,
			"is_active":  user.IsActive,
			"created_at": user.CreatedAt,
		})
	}
	return c.JSON(response)
}

