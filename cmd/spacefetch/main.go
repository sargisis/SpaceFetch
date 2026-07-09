// spacefetch — command-line client for the SpaceFetch API.
//
//	spacefetch login sf_live_...   save & verify your API key
//	spacefetch today               today's near-Earth asteroids as a table
//	spacefetch apod                NASA Astronomy Picture of the Day
//	spacefetch epic                latest DSCOVR photo of Earth
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"github.com/sargisis/spacefetch/internal/models"
)

const (
	version        = "0.1.0"
	defaultBaseURL = "http://127.0.0.1:8080"
)

// ANSI colors (enabled on Windows via SetConsoleMode)
var (
	cReset  = "\033[0m"
	cBold   = "\033[1m"
	cDim    = "\033[2m"
	cRed    = "\033[31m"
	cGreen  = "\033[32m"
	cYellow = "\033[33m"
	cCyan   = "\033[36m"
)

type config struct {
	APIKey  string `json:"api_key"`
	BaseURL string `json:"base_url,omitempty"`
}

type envelope struct {
	Status  string          `json:"status"`
	Message string          `json:"message"`
	Meta    json.RawMessage `json:"meta"`
	Data    json.RawMessage `json:"data"`
}

func main() {
	enableANSI()
	if os.Getenv("NO_COLOR") != "" {
		cReset, cBold, cDim, cRed, cGreen, cYellow, cCyan = "", "", "", "", "", "", ""
	}

	if len(os.Args) < 2 {
		usage()
		return
	}

	var err error
	switch os.Args[1] {
	case "login":
		err = cmdLogin(os.Args[2:])
	case "today":
		err = cmdToday(os.Args[2:])
	case "apod":
		err = cmdAPOD(os.Args[2:])
	case "epic":
		err = cmdEPIC(os.Args[2:])
	case "version", "-v", "--version":
		fmt.Println("spacefetch v" + version)
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", os.Args[1])
		usage()
		os.Exit(1)
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "%serror:%s %v\n", cRed, cReset, err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Printf(`%s🌌 spacefetch%s v%s — the Universe at your fingertips

%sUSAGE%s
  spacefetch <command> [flags]

%sCOMMANDS%s
  login <api-key>   verify and save your API key (register at the SpaceFetch site)
  today             today's near-Earth asteroids
  apod              NASA Astronomy Picture of the Day
  epic              latest photo of Earth from the DSCOVR satellite
  version           print version

%sFLAGS%s
  --json            raw JSON output (today, apod, epic)
  --lang <code>     asteroid summaries language: en ru pl uk hy ka de es fr (today)
  --save [file]     download the image (apod, epic)
  --api <url>       API base URL (default %s or config)

%sEXAMPLES%s
  spacefetch login sf_live_abc123
  spacefetch today --lang ru
  spacefetch apod --save
  spacefetch epic --save earth.png
`, cBold, cReset, version, cBold, cReset, cBold, cReset, cBold, cReset, defaultBaseURL, cBold, cReset)
}

// ---------- config ----------

func configPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".spacefetch.json"
	}
	return filepath.Join(home, ".spacefetch.json")
}

func loadConfig() config {
	var c config
	data, err := os.ReadFile(configPath())
	if err == nil {
		_ = json.Unmarshal(data, &c)
	}
	if c.BaseURL == "" {
		c.BaseURL = defaultBaseURL
	}
	if env := os.Getenv("SPACEFETCH_API"); env != "" {
		c.BaseURL = env
	}
	if env := os.Getenv("SPACEFETCH_KEY"); env != "" {
		c.APIKey = env
	}
	return c
}

func saveConfig(c config) error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath(), data, 0600)
}

// ---------- HTTP ----------

func apiGet(cfg config, path string) (*envelope, error) {
	if cfg.APIKey == "" {
		return nil, fmt.Errorf("no API key configured — run: spacefetch login <api-key>")
	}
	req, err := http.NewRequest(http.MethodGet, strings.TrimRight(cfg.BaseURL, "/")+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-Key", cfg.APIKey)

	cli := &http.Client{Timeout: 30 * time.Second}
	resp, err := cli.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cannot reach %s — is the server running? (%v)", cfg.BaseURL, err)
	}
	defer resp.Body.Close()

	var env envelope
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		return nil, fmt.Errorf("unexpected response (HTTP %d)", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		if env.Message != "" {
			return nil, fmt.Errorf("%s (HTTP %d)", env.Message, resp.StatusCode)
		}
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return &env, nil
}

// ---------- commands ----------

func cmdLogin(args []string) error {
	if len(args) < 1 || strings.HasPrefix(args[0], "-") {
		return fmt.Errorf("usage: spacefetch login <api-key>")
	}
	key := args[0]
	if strings.Contains(key, "mock") {
		return fmt.Errorf("this is a mock demo key — register on the SpaceFetch site to get a real one")
	}

	cfg := loadConfig()
	cfg.APIKey = key
	if _, err := apiGet(cfg, "/v1/asteroids/today"); err != nil {
		return fmt.Errorf("key verification failed: %w", err)
	}
	if err := saveConfig(cfg); err != nil {
		return fmt.Errorf("cannot save config: %w", err)
	}
	fmt.Printf("%s✔%s API key verified and saved to %s\n", cGreen, cReset, configPath())
	return nil
}

func cmdToday(args []string) error {
	fs := flag.NewFlagSet("today", flag.ExitOnError)
	asJSON := fs.Bool("json", false, "raw JSON output")
	lang := fs.String("lang", "", "summary language (en, ru, ...)")
	api := fs.String("api", "", "API base URL")
	_ = fs.Parse(args)

	cfg := loadConfig()
	if *api != "" {
		cfg.BaseURL = *api
	}

	env, err := apiGet(cfg, "/v1/asteroids/today")
	if err != nil {
		return err
	}
	if *asJSON {
		fmt.Println(string(env.Data))
		return nil
	}

	var asteroids []models.Asteroid
	if err := json.Unmarshal(env.Data, &asteroids); err != nil {
		return fmt.Errorf("decode: %w", err)
	}
	if len(asteroids) == 0 {
		fmt.Printf("%sNo asteroids recorded today. Space environment secure.%s\n", cDim, cReset)
		return nil
	}

	fmt.Printf("\n%s🌌 Near-Earth asteroids — %s%s\n\n", cBold, time.Now().UTC().Format("2006-01-02"), cReset)
	fmt.Printf("%s%-3s %-22s %-8s %10s %12s %14s %10s%s\n",
		cDim, "#", "NAME", "HAZARD", "DIAMETER", "SPEED", "MISS DIST", "VALUE", cReset)

	for i, a := range asteroids {
		hazard := cGreen + "safe" + cReset + "  "
		if a.IsHazardous {
			hazard = cRed + cBold + "PHA ⚠" + cReset + " "
		}
		fmt.Printf("%-3d %s%-22s%s %s %9.0fm %10.0f/h %12.1fM %s%10s%s\n",
			i+1,
			cCyan, trunc(a.Name, 22), cReset,
			hazard,
			a.Metrics.DiameterMeters,
			a.Metrics.VelocityKmH,
			a.Metrics.MissDistanceKm/1e6,
			cGreen, humanUSD(a.MiningEconomy.EstimatedValueUSD), cReset,
		)
		if *lang != "" {
			if s, ok := a.AISummary[*lang]; ok {
				fmt.Printf("    %s%s%s\n", cDim, s, cReset)
			}
		}
	}
	fmt.Printf("\n%s%d objects · data: NASA NeoWs · api: %s%s\n", cDim, len(asteroids), cfg.BaseURL, cReset)
	return nil
}

func cmdAPOD(args []string) error {
	fs := flag.NewFlagSet("apod", flag.ExitOnError)
	asJSON := fs.Bool("json", false, "raw JSON output")
	save := fs.Bool("save", false, "download the image")
	api := fs.String("api", "", "API base URL")
	_ = fs.Parse(args)

	cfg := loadConfig()
	if *api != "" {
		cfg.BaseURL = *api
	}

	env, err := apiGet(cfg, "/v1/apod")
	if err != nil {
		return err
	}
	if *asJSON {
		fmt.Println(string(env.Data))
		return nil
	}

	var apod models.APOD
	if err := json.Unmarshal(env.Data, &apod); err != nil {
		return fmt.Errorf("decode: %w", err)
	}

	fmt.Printf("\n%s🔭 %s%s  %s(%s)%s\n\n", cBold, apod.Title, cReset, cDim, apod.Date, cReset)
	fmt.Println(wrap(apod.Explanation, 78))
	fmt.Printf("\n%sImage:%s %s\n", cCyan, cReset, apod.URL)
	if apod.HDURL != "" {
		fmt.Printf("%sHD:%s    %s\n", cCyan, cReset, apod.HDURL)
	}

	if *save {
		url := apod.HDURL
		if url == "" {
			url = apod.URL
		}
		if apod.MediaType != "image" {
			return fmt.Errorf("today's APOD is a %s, not an image — open the URL above", apod.MediaType)
		}
		name := fs.Arg(0)
		if name == "" {
			name = "apod-" + apod.Date + filepath.Ext(url)
		}
		return download(url, name)
	}
	return nil
}

func cmdEPIC(args []string) error {
	fs := flag.NewFlagSet("epic", flag.ExitOnError)
	asJSON := fs.Bool("json", false, "raw JSON output")
	save := fs.Bool("save", false, "download the image")
	api := fs.String("api", "", "API base URL")
	_ = fs.Parse(args)

	cfg := loadConfig()
	if *api != "" {
		cfg.BaseURL = *api
	}

	env, err := apiGet(cfg, "/v1/epic")
	if err != nil {
		return err
	}
	if *asJSON {
		fmt.Println(string(env.Data))
		return nil
	}

	var epic models.EPICImage
	if err := json.Unmarshal(env.Data, &epic); err != nil {
		return fmt.Errorf("decode: %w", err)
	}

	fmt.Printf("\n%s🌍 Earth from L1 (DSCOVR EPIC)%s  %s%s UTC%s\n\n", cBold, cReset, cDim, epic.Date, cReset)
	fmt.Println(wrap(epic.Caption, 78))
	fmt.Printf("\n%sCentroid:%s %.2f, %.2f\n", cCyan, cReset, epic.Latitude, epic.Longitude)
	fmt.Printf("%sImage:%s    %s\n", cCyan, cReset, epic.ImageURL)

	if *save {
		name := fs.Arg(0)
		if name == "" {
			name = "earth-" + strings.ReplaceAll(strings.Fields(epic.Date)[0], "-", "") + ".png"
		}
		return download(epic.ImageURL, name)
	}
	return nil
}

// ---------- helpers ----------

func download(url, name string) error {
	fmt.Printf("\n%s⬇ downloading…%s ", cYellow, cReset)
	cli := &http.Client{Timeout: 120 * time.Second}
	resp, err := cli.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}

	f, err := os.Create(name)
	if err != nil {
		return err
	}
	defer f.Close()

	n, err := io.Copy(f, resp.Body)
	if err != nil {
		return err
	}
	fmt.Printf("%s✔%s saved %s (%s)\n", cGreen, cReset, name, humanBytes(n))
	return nil
}

func trunc(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

func humanUSD(v int64) string {
	f := float64(v)
	switch {
	case f >= 1e12:
		return fmt.Sprintf("$%.1fT", f/1e12)
	case f >= 1e9:
		return fmt.Sprintf("$%.1fB", f/1e9)
	case f >= 1e6:
		return fmt.Sprintf("$%.1fM", f/1e6)
	case f >= 1e3:
		return fmt.Sprintf("$%.1fK", f/1e3)
	default:
		return fmt.Sprintf("$%d", v)
	}
}

func humanBytes(n int64) string {
	switch {
	case n >= 1<<20:
		return fmt.Sprintf("%.1f MB", float64(n)/(1<<20))
	case n >= 1<<10:
		return fmt.Sprintf("%.1f KB", float64(n)/(1<<10))
	default:
		return fmt.Sprintf("%d B", n)
	}
}

func wrap(s string, width int) string {
	words := strings.Fields(s)
	if len(words) == 0 {
		return s
	}
	var b strings.Builder
	line := 0
	for _, w := range words {
		if line+len(w)+1 > width {
			b.WriteString("\n")
			line = 0
		} else if line > 0 {
			b.WriteString(" ")
			line++
		}
		b.WriteString(w)
		line += len(w)
	}
	return b.String()
}

// enableANSI turns on VT escape-sequence processing in the classic Windows console.
func enableANSI() {
	if runtime.GOOS != "windows" {
		return
	}
	k32 := syscall.NewLazyDLL("kernel32.dll")
	getMode := k32.NewProc("GetConsoleMode")
	setMode := k32.NewProc("SetConsoleMode")
	h := syscall.Handle(os.Stdout.Fd())
	var mode uint32
	if r, _, _ := getMode.Call(uintptr(h), uintptr(unsafe.Pointer(&mode))); r != 0 {
		const enableVT = 0x0004
		setMode.Call(uintptr(h), uintptr(mode|enableVT))
	}
}
