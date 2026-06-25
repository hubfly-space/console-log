package bridge

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
)

// GenerateTypescript generates a Typescript client for the registered procedures.
func (r *Registry) GenerateTypescript(outputPath string) error {
	var sb strings.Builder

	sb.WriteString("// This file is auto-generated. Do not edit.\n\n")
	sb.WriteString("export interface BridgeConfig {\n")
	sb.WriteString("  baseUrl?: string;\n")
	sb.WriteString("  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);\n")
	sb.WriteString("}\n\n")

	// Collect all unique types used in inputs and outputs
	typeMap := make(map[string]reflect.Type)
	var procNames []string
	for name := range r.Procedures {
		procNames = append(procNames, name)
	}
	sort.Strings(procNames)

	for _, name := range procNames {
		p := r.Procedures[name]
		r.collectTypes(p.InputType, typeMap)
		r.collectTypes(p.OutputType, typeMap)
	}

	// Generate interfaces for all discovered types
	var typeNames []string
	for name := range typeMap {
		typeNames = append(typeNames, name)
	}
	sort.Strings(typeNames)

	for _, name := range typeNames {
		t := typeMap[name]
		if t.Kind() == reflect.Struct {
			sb.WriteString(fmt.Sprintf("export interface %s {\n", name))
			for i := 0; i < t.NumField(); i++ {
				field := t.Field(i)
				jsonTag := field.Tag.Get("json")
				if jsonTag == "-" {
					continue
				}
				fieldName := strings.Split(jsonTag, ",")[0]
				if fieldName == "" {
					fieldName = field.Name
				}
				sb.WriteString(fmt.Sprintf("  %s: %s;\n", fieldName, r.goTypeToTS(field.Type)))
			}
			sb.WriteString("}\n\n")
		}
	}

	// Generate the client class
	sb.WriteString("export class BridgeClient {\n")
	sb.WriteString("  private config: BridgeConfig;\n\n")
	sb.WriteString("  constructor(config: BridgeConfig = {}) {\n")
	sb.WriteString("    this.config = config;\n")
	sb.WriteString("  }\n\n")
	sb.WriteString("  private async getHeaders(): Promise<Record<string, string>> {\n")
	sb.WriteString("    let headers: Record<string, string> = { 'Content-Type': 'application/json' };\n")
	sb.WriteString("    if (this.config.headers) {\n")
	sb.WriteString("      const extraHeaders = typeof this.config.headers === 'function' ? await this.config.headers() : this.config.headers;\n")
	sb.WriteString("      headers = { ...headers, ...extraHeaders };\n")
	sb.WriteString("    }\n")
	sb.WriteString("    return headers;\n")
	sb.WriteString("  }\n\n")

	for _, name := range procNames {
		p := r.Procedures[name]
		sb.WriteString(fmt.Sprintf("  /** %s */\n", p.Description))
		sb.WriteString(fmt.Sprintf("  async %s(input: %s): Promise<%s> {\n", name, r.goTypeToTS(p.InputType), r.goTypeToTS(p.OutputType)))
		sb.WriteString(fmt.Sprintf("    const res = await fetch(`${this.config.baseUrl || ''}/api/v1/bridge/%s`, {\n", name))
		sb.WriteString("      method: 'POST',\n")
		sb.WriteString("      headers: await this.getHeaders(),\n")
		sb.WriteString("      body: JSON.stringify(input),\n")
		sb.WriteString("    });\n")
		sb.WriteString("    if (!res.ok) {\n")
		sb.WriteString("      const text = await res.text();\n")
		sb.WriteString("      throw new Error(text || `Bridge error: ${res.status}`);\n")
		sb.WriteString("    }\n")
		sb.WriteString("    return res.json();\n")
		sb.WriteString("  }\n\n")
	}
	sb.WriteString("}\n\n")
	sb.WriteString("export const API = new BridgeClient();\n")

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}

	return os.WriteFile(outputPath, []byte(sb.String()), 0644)
}

func (r *Registry) collectTypes(t reflect.Type, typeMap map[string]reflect.Type) {
	for t.Kind() == reflect.Ptr || t.Kind() == reflect.Slice || t.Kind() == reflect.Array || t.Kind() == reflect.Map {
		if t.Kind() == reflect.Map {
			r.collectTypes(t.Key(), typeMap)
		}
		t = t.Elem()
	}

	if t.Kind() == reflect.Struct {
		if _, ok := typeMap[t.Name()]; ok {
			return
		}
		if t.Name() == "" {
			return // anonymous struct
		}
		typeMap[t.Name()] = t
		for i := 0; i < t.NumField(); i++ {
			r.collectTypes(t.Field(i).Type, typeMap)
		}
	}
}

func (r *Registry) goTypeToTS(t reflect.Type) string {
	switch t.Kind() {
	case reflect.String:
		return "string"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
		reflect.Float32, reflect.Float64:
		return "number"
	case reflect.Bool:
		return "boolean"
	case reflect.Interface:
		return "any"
	case reflect.Ptr:
		return r.goTypeToTS(t.Elem())
	case reflect.Slice, reflect.Array:
		return fmt.Sprintf("%s[]", r.goTypeToTS(t.Elem()))
	case reflect.Map:
		return fmt.Sprintf("Record<%s, %s>", r.goTypeToTS(t.Key()), r.goTypeToTS(t.Elem()))
	case reflect.Struct:
		if t.Name() == "" {
			return "any"
		}
		return t.Name()
	default:
		return "any"
	}
}
