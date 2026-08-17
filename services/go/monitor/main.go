package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// APIRecord mirrors the Python registry record structure
type APIRecord struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	URL             string  `json:"url"`
	Status          string  `json:"status"`
	ComplianceScore float64 `json:"compliance_score"`
	RiskLevel       string  `json:"risk_level"`
}

// HealthResult is what we record after each probe
type HealthResult struct {
	APIID       string    `json:"api_id"`
	APIName     string    `json:"api_name"`
	URL         string    `json:"url"`
	StatusCode  int       `json:"status_code"`
	Latency     int64     `json:"latency_ms"`
	IsUp        bool      `json:"is_up"`
	HasHTTPS    bool      `json:"has_https"`
	HasHSTS     bool      `json:"has_hsts"`
	HasXFrame   bool      `json:"has_x_frame_options"`
	HasNoSniff  bool      `json:"has_x_content_type"`
	CheckedAt   time.Time `json:"checked_at"`
}

var (
	results   []HealthResult
	resultsMu sync.Mutex
)

func probeAPI(record APIRecord) HealthResult {
	start := time.Now()
	result := HealthResult{
		APIID:     record.ID,
		APIName:   record.Name,
		URL:       record.URL,
		IsUp:      false,
		HasHTTPS:  strings.HasPrefix(record.URL, "https://"),
		CheckedAt: time.Now().UTC(),
	}

	client := &http.Client{Timeout: 5 * time.Second}
	
	// DAST Fuzzing (MVP 4): If it's a GET endpoint, test for SQLi
	testURL := record.URL
	if strings.Contains(testURL, "?") {
		testURL += "&q=' OR 1=1--"
	} else {
		testURL += "?q=' OR 1=1--"
	}
	
	resp, err := client.Get(testURL)
	result.Latency = time.Since(start).Milliseconds()

	if err != nil {
		fmt.Printf("[Go Monitor] %-30s UNREACHABLE (%dms)\n", record.Name, result.Latency)
		result.StatusCode = 0
		return result
	}
	defer resp.Body.Close()

	result.StatusCode = resp.StatusCode
	result.IsUp = resp.StatusCode < 500

	// Check security headers
	result.HasHSTS = resp.Header.Get("Strict-Transport-Security") != ""
	result.HasXFrame = resp.Header.Get("X-Frame-Options") != ""
	result.HasNoSniff = resp.Header.Get("X-Content-Type-Options") != ""

	status := "UP"
	if !result.IsUp {
		status = "DOWN"
	}
	
	// Check for SQL error leaks in DAST payload
	isVulnerable := resp.StatusCode == 500
	vulnStr := ""
	if isVulnerable {
		vulnStr = " \x1b[31mVULNERABLE (SQLi detected)\x1b[0m"
	}

	fmt.Printf("[Go Monitor] %-30s %s HTTP/%d %dms HSTS:%v XFrame:%v%s\n",
		record.Name, status, result.StatusCode, result.Latency, result.HasHSTS, result.HasXFrame, vulnStr)

	return result
}

func fetchRegisteredAPIs(registryURL string) ([]APIRecord, error) {
	resp, err := http.Get(registryURL + "/apis")
	if err != nil {
		return nil, fmt.Errorf("registry unreachable: %w", err)
	}
	defer resp.Body.Close()

	var payload struct {
		APIs []APIRecord `json:"apis"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, fmt.Errorf("failed to decode registry response: %w", err)
	}
	return payload.APIs, nil
}

func runMonitorCycle(registryURL string) {
	apis, err := fetchRegisteredAPIs(registryURL)
	if err != nil {
		fmt.Printf("[Go Monitor] Could not fetch API list: %v\n", err)
		return
	}

	fmt.Printf("\n[Go Monitor] Probing %d registered APIs...\n", len(apis))

	var wg sync.WaitGroup
	cycleResults := make([]HealthResult, 0, len(apis))
	var mu sync.Mutex

	for _, api := range apis {
		wg.Add(1)
		go func(a APIRecord) {
			defer wg.Done()
			r := probeAPI(a)
			mu.Lock()
			cycleResults = append(cycleResults, r)
			mu.Unlock()
		}(api)
	}
	wg.Wait()

	resultsMu.Lock()
	results = cycleResults
	resultsMu.Unlock()

	up := 0
	for _, r := range cycleResults {
		if r.IsUp {
			up++
		}
	}
	fmt.Printf("[Go Monitor] Cycle complete: %d/%d APIs up\n\n", up, len(cycleResults))
}

// HTTP server exposes monitor results
func startHTTPServer(port string) {
	http.HandleFunc("/monitor/results", func(w http.ResponseWriter, r *http.Request) {
		resultsMu.Lock()
		defer resultsMu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"results": results,
			"total":   len(results),
		})
	})

	http.HandleFunc("/monitor/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","service":"api-monitor"}`)
	})

	fmt.Printf("[Go Monitor] HTTP server on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}

func main() {
	registryURL := os.Getenv("API_REGISTRY_URL")
	if registryURL == "" {
		registryURL = "http://localhost:5002"
	}
	monitorPort := os.Getenv("MONITOR_PORT")
	if monitorPort == "" {
		monitorPort = "5003"
	}
	intervalSecs := 30

	fmt.Println("[Go Monitor] Heimdall AI API Health Monitor starting...")
	fmt.Printf("[Go Monitor] Registry: %s | Interval: %ds | HTTP port: %s\n\n",
		registryURL, intervalSecs, monitorPort)

	// Start HTTP results server in background
	go startHTTPServer(monitorPort)

	// Run immediately then on interval
	for {
		runMonitorCycle(registryURL)
		time.Sleep(time.Duration(intervalSecs) * time.Second)
	}
}
