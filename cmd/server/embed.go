//go:build embed_frontend
// +build embed_frontend

package main

import (
	"embed"
	"io/fs"
	"log"
)

//go:embed web/dist/*
var embeddedFrontend embed.FS

func init() {
	var err error
	frontendFS, err = fs.Sub(embeddedFrontend, "web/dist")
	if err != nil {
		log.Fatalf("failed to create sub filesystem for embedded frontend: %v", err)
	}
}
