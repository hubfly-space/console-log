package handler

import (
	"context"
	"fmt"
	"time"
)

type LoginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginOutput struct {
	Success bool   `json:"success"`
	Token   string `json:"token"`
	User    User   `json:"user"`
}

type User struct {
	ID    int    `json:"id"`
	Email string `json:"email"`
}

func (a *APIHandler) Login(ctx context.Context, in LoginInput) (LoginOutput, error) {
	// Sample logic
	if in.Username == "admin" && in.Password == "password" {
		return LoginOutput{
			Success: true,
			Token:   "fake-jwt-token",
			User: User{
				ID:    1,
				Email: "admin@example.com",
			},
		}, nil
	}
	return LoginOutput{Success: false}, fmt.Errorf("invalid credentials")
}

type HelloInput struct {
	Name string `json:"name"`
}

type HelloOutput struct {
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

func (a *APIHandler) Hello(ctx context.Context, in HelloInput) (HelloOutput, error) {
	return HelloOutput{
		Message:   fmt.Sprintf("Hello, %s!", in.Name),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}
