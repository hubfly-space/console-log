package handler

import "net/http"

// Build-time variables injected via ldflags.
// These are set during compilation by the Makefile.
var (
	Version   = "dev"
	GitCommit = "unknown"
	GitBranch = "unknown"
	BuildTime = "unknown"
	GoVersion = "unknown"
	BuildOS   = "unknown"
	BuildArch = "unknown"
)

// versionResponse is the JSON response for the version endpoint.
type versionResponse struct {
	Version   string `json:"version"`
	GitCommit string `json:"git_commit"`
	GitBranch string `json:"git_branch"`
	BuildTime string `json:"build_time"`
	GoVersion string `json:"go_version"`
	OS        string `json:"os"`
	Arch      string `json:"arch"`
}

// VersionHandler serves the /version endpoint.
func VersionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	resp := versionResponse{
		Version:   Version,
		GitCommit: GitCommit,
		GitBranch: GitBranch,
		BuildTime: BuildTime,
		GoVersion: GoVersion,
		OS:        BuildOS,
		Arch:      BuildArch,
	}

	writeJSON(w, http.StatusOK, resp)
}
