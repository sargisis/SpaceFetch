package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID           primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Email        string             `json:"email" bson:"email"`
	HashedAPIKey string             `json:"-" bson:"hashed_api_key"`
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
