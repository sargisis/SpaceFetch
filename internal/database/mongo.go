package database

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/sargisis/spacefetch/internal/models"
)

type MongoDB struct {
	client    *mongo.Client
	asteroids *mongo.Collection
	users     *mongo.Collection
}

func NewMongoDB(uri, dbName string) (*MongoDB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, fmt.Errorf("mongo connect: %w", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("mongo ping: %w", err)
	}

	asteroids := client.Database(dbName).Collection("asteroids")
	users := client.Database(dbName).Collection("users")

	// Ensure unique index on Email for User collection
	_, err = users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return nil, fmt.Errorf("mongo create index: %w", err)
	}

	return &MongoDB{
		client:    client,
		asteroids: asteroids,
		users:     users,
	}, nil
}

func (m *MongoDB) CreateUser(ctx context.Context, email, hashedKey, tier string) (*models.User, error) {
	now := time.Now().UTC()
	user := &models.User{
		ID:           primitive.NewObjectID(),
		Email:        email,
		HashedAPIKey: hashedKey,
		Tier:         tier,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	_, err := m.users.InsertOne(ctx, user)
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (m *MongoDB) GetUserByHashedKey(ctx context.Context, hashedKey string) (*models.User, error) {
	var user models.User
	err := m.users.FindOne(ctx, bson.M{"hashed_api_key": hashedKey}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (m *MongoDB) UpsertAsteroids(ctx context.Context, asteroids []models.Asteroid) error {
	if len(asteroids) == 0 {
		return nil
	}

	models := make([]mongo.WriteModel, len(asteroids))
	for i, a := range asteroids {
		models[i] = mongo.NewReplaceOneModel().
			SetFilter(bson.M{"_id": a.ID}).
			SetReplacement(a).
			SetUpsert(true)
	}

	_, err := m.asteroids.BulkWrite(ctx, models)
	return err
}

func (m *MongoDB) GetTodayAsteroids(ctx context.Context) ([]models.Asteroid, error) {
	today := time.Now().UTC().Format("2006-01-02")
	cursor, err := m.asteroids.Find(ctx, bson.M{"close_approach_date": today})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var asteroids []models.Asteroid
	if err := cursor.All(ctx, &asteroids); err != nil {
		return nil, err
	}
	return asteroids, nil
}

func (m *MongoDB) Close() error {
	return m.client.Disconnect(context.Background())
}
