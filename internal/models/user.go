package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID           primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Email        string             `json:"email" bson:"email"`
	HashedAPIKey string             `json:"-" bson:"hashed_api_key"`
	PasswordHash string             `json:"-" bson:"password_hash,omitempty"`
	Tier         string             `json:"tier" bson:"tier"` // "free" or "premium"
	CreatedAt    time.Time          `json:"created_at" bson:"created_at"`
	UpdatedAt    time.Time          `json:"updated_at" bson:"updated_at"`
}

type UserRegisterRequest struct {
	Email string `json:"email"`
	Tier  string `json:"tier"` // optional, defaults to "free"
}

type UserRegisterResponse struct {
	Status string `json:"status"`
	Email  string `json:"email"`
	APIKey string `json:"api_key"`
	Tier   string `json:"tier"`
}

// Cookie-session auth (web console)

type AuthRegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Tier     string `json:"tier"` // optional, defaults to "free"
}

type AuthLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthSessionResponse struct {
	Status string `json:"status"`
	Email  string `json:"email"`
	Tier   string `json:"tier"`
}

type RegenerateKeyResponse struct {
	Status string `json:"status"`
	APIKey string `json:"api_key"`
}
