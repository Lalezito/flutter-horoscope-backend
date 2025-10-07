#!/usr/bin/env node

/**
 * PERFORMANCE REGRESSION CHECKER
 * 
 * Analyzes Artillery.js performance test results and checks for regressions
 * Fails the CI/CD pipeline if performance degrades beyond acceptable thresholds
 */

const fs = require('fs');
const path = require('path');

// Performance thresholds (configurable via environment variables)
const THRESHOLDS = {
  // Response time thresholds (in milliseconds)
  MAX_MEDIAN_RESPONSE_TIME: parseInt(process.env.MAX_MEDIAN_RESPONSE_TIME) || 500,
  MAX_95TH_PERCENTILE: parseInt(process.env.MAX_95TH_PERCENTILE) || 1000,
  MAX_99TH_PERCENTILE: parseInt(process.env.MAX_99TH_PERCENTILE) || 2000,
  
  // Error rate thresholds (in percentage)
  MAX_ERROR_RATE: parseFloat(process.env.MAX_ERROR_RATE) || 1.0,
  
  // Throughput thresholds
  MIN_REQUESTS_PER_SECOND: parseInt(process.env.MIN_REQUESTS_PER_SECOND) || 50,
  
  // Regression thresholds (percentage increase from baseline)
  MAX_RESPONSE_TIME_REGRESSION: parseFloat(process.env.MAX_RESPONSE_TIME_REGRESSION) || 20.0,
  MAX_ERROR_RATE_REGRESSION: parseFloat(process.env.MAX_ERROR_RATE_REGRESSION) || 50.0,
  MIN_THROUGHPUT_REGRESSION: parseFloat(process.env.MIN_THROUGHPUT_REGRESSION) || -10.0
};

// Baseline performance data file
const BASELINE_FILE = process.env.BASELINE_FILE || 'performance-baseline.json';

class PerformanceChecker {
  constructor() {
    this.results = null;
    this.baseline = null;
    this.regressions = [];
    this.violations = [];
  }

  /**
   * Main execution function
   */
  async run(reportFile) {
    try {
      console.log('🚀 Starting performance regression analysis...');
      
      // Load test results
      this.results = await this.loadResults(reportFile);
      if (!this.results) {
        throw new Error('Failed to load performance results');
      }
      
      // Load baseline if available
      this.baseline = await this.loadBaseline();
      
      // Analyze results
      this.analyzeResults();
      
      // Check for regressions against baseline
      if (this.baseline) {
        this.checkRegressions();
      }
      
      // Generate report
      this.generateReport();
      
      // Determine if checks passed
      const passed = this.violations.length === 0 && this.regressions.length === 0;
      
      if (passed) {
        console.log('✅ Performance checks passed!');
        await this.updateBaseline();
        process.exit(0);
      } else {
        console.log('❌ Performance checks failed!');
        this.printFailures();
        process.exit(1);
      }
      
    } catch (error) {
      console.error('💥 Performance check failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Load Artillery.js test results
   */
  async loadResults(reportFile) {
    try {
      if (!fs.existsSync(reportFile)) {
        throw new Error(`Performance report file not found: ${reportFile}`);
      }
      
      const data = fs.readFileSync(reportFile, 'utf8');
      const results = JSON.parse(data);
      
      console.log(`📊 Loaded performance results from ${reportFile}`);
      console.log(`📈 Test duration: ${results.aggregate?.phases?.length || 'unknown'} phases`);
      console.log(`🔢 Total requests: ${results.aggregate?.counters?.['http.requests'] || 'unknown'}`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Failed to load performance results:', error.message);
      return null;
    }
  }

  /**
   * Load baseline performance data
   */
  async loadBaseline() {
    try {
      if (!fs.existsSync(BASELINE_FILE)) {
        console.log('📋 No baseline found, current results will become the baseline');
        return null;
      }
      
      const data = fs.readFileSync(BASELINE_FILE, 'utf8');
      const baseline = JSON.parse(data);
      
      console.log(`📊 Loaded performance baseline from ${BASELINE_FILE}`);
      console.log(`📅 Baseline date: ${baseline.timestamp || 'unknown'}`);
      
      return baseline;
      
    } catch (error) {
      console.warn('⚠️ Failed to load baseline:', error.message);
      return null;
    }
  }

  /**
   * Analyze current results against absolute thresholds
   */
  analyzeResults() {
    console.log('🔍 Analyzing performance results...');
    
    const aggregate = this.results.aggregate;
    if (!aggregate) {
      throw new Error('No aggregate data found in results');
    }
    
    // Response time analysis
    const responseTime = aggregate.latency;
    if (responseTime) {
      this.checkThreshold(
        'Median Response Time',
        responseTime.median,
        THRESHOLDS.MAX_MEDIAN_RESPONSE_TIME,
        'ms',
        'less_than'
      );
      
      this.checkThreshold(
        '95th Percentile Response Time',
        responseTime.p95,
        THRESHOLDS.MAX_95TH_PERCENTILE,
        'ms',
        'less_than'
      );
      
      this.checkThreshold(
        '99th Percentile Response Time',
        responseTime.p99,
        THRESHOLDS.MAX_99TH_PERCENTILE,
        'ms',
        'less_than'
      );
    }
    
    // Error rate analysis
    const counters = aggregate.counters;
    if (counters) {
      const totalRequests = counters['http.requests'] || 0;
      const errors = counters['http.request_rate'] || 0;
      const errorRate = totalRequests > 0 ? (errors / totalRequests) * 100 : 0;
      
      this.checkThreshold(
        'Error Rate',
        errorRate,
        THRESHOLDS.MAX_ERROR_RATE,
        '%',
        'less_than'
      );
    }
    
    // Throughput analysis
    const rates = aggregate.rates;
    if (rates && rates['http.request_rate']) {
      this.checkThreshold(
        'Requests Per Second',
        rates['http.request_rate'],
        THRESHOLDS.MIN_REQUESTS_PER_SECOND,
        'req/s',
        'greater_than'
      );
    }
  }

  /**
   * Check for performance regressions against baseline
   */
  checkRegressions() {
    if (!this.baseline || !this.baseline.aggregate) {
      return;
    }
    
    console.log('📊 Checking for performance regressions...');
    
    const current = this.results.aggregate;
    const baseline = this.baseline.aggregate;
    
    // Response time regression
    if (current.latency && baseline.latency) {
      this.checkRegression(
        'Median Response Time',
        current.latency.median,
        baseline.latency.median,
        THRESHOLDS.MAX_RESPONSE_TIME_REGRESSION,
        'ms',
        'increase'
      );
      
      this.checkRegression(
        '95th Percentile Response Time',
        current.latency.p95,
        baseline.latency.p95,
        THRESHOLDS.MAX_RESPONSE_TIME_REGRESSION,
        'ms',
        'increase'
      );
    }
    
    // Error rate regression
    if (current.counters && baseline.counters) {
      const currentErrorRate = this.calculateErrorRate(current.counters);
      const baselineErrorRate = this.calculateErrorRate(baseline.counters);
      
      this.checkRegression(
        'Error Rate',
        currentErrorRate,
        baselineErrorRate,
        THRESHOLDS.MAX_ERROR_RATE_REGRESSION,
        '%',
        'increase'
      );
    }
    
    // Throughput regression
    if (current.rates && baseline.rates) {
      const currentRPS = current.rates['http.request_rate'];
      const baselineRPS = baseline.rates['http.request_rate'];
      
      if (currentRPS && baselineRPS) {
        this.checkRegression(
          'Requests Per Second',
          currentRPS,
          baselineRPS,
          Math.abs(THRESHOLDS.MIN_THROUGHPUT_REGRESSION),
          'req/s',
          'decrease'
        );
      }
    }
  }

  /**
   * Check a metric against an absolute threshold
   */
  checkThreshold(metricName, value, threshold, unit, comparison) {
    if (value === undefined || value === null) {
      return;
    }
    
    let violated = false;
    
    if (comparison === 'less_than' && value > threshold) {
      violated = true;
    } else if (comparison === 'greater_than' && value < threshold) {
      violated = true;
    }
    
    if (violated) {
      this.violations.push({
        type: 'threshold',
        metric: metricName,
        value: value,
        threshold: threshold,
        unit: unit,
        comparison: comparison
      });
    }
    
    const status = violated ? '❌' : '✅';
    const operator = comparison === 'less_than' ? '<=' : '>=';
    console.log(`${status} ${metricName}: ${value}${unit} ${operator} ${threshold}${unit}`);
  }

  /**
   * Check for regression against baseline
   */
  checkRegression(metricName, currentValue, baselineValue, thresholdPercent, unit, direction) {
    if (currentValue === undefined || baselineValue === undefined || baselineValue === 0) {
      return;
    }
    
    const changePercent = ((currentValue - baselineValue) / baselineValue) * 100;
    let violated = false;
    
    if (direction === 'increase' && changePercent > thresholdPercent) {
      violated = true;
    } else if (direction === 'decrease' && changePercent < -thresholdPercent) {
      violated = true;
    }
    
    if (violated) {
      this.regressions.push({
        type: 'regression',
        metric: metricName,
        current: currentValue,
        baseline: baselineValue,
        changePercent: changePercent,
        thresholdPercent: thresholdPercent,
        unit: unit,
        direction: direction
      });
    }
    
    const status = violated ? '❌' : '✅';
    const sign = changePercent >= 0 ? '+' : '';
    console.log(`${status} ${metricName} regression: ${sign}${changePercent.toFixed(2)}% (${currentValue}${unit} vs ${baselineValue}${unit})`);
  }

  /**
   * Calculate error rate from counters
   */
  calculateErrorRate(counters) {
    const totalRequests = counters['http.requests'] || 0;
    const errors = (counters['http.codes.4xx'] || 0) + (counters['http.codes.5xx'] || 0);
    
    return totalRequests > 0 ? (errors / totalRequests) * 100 : 0;
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_violations: this.violations.length,
        total_regressions: this.regressions.length,
        passed: this.violations.length === 0 && this.regressions.length === 0
      },
      current_results: this.extractKeyMetrics(this.results),
      baseline_results: this.baseline ? this.extractKeyMetrics(this.baseline) : null,
      violations: this.violations,
      regressions: this.regressions,
      thresholds: THRESHOLDS
    };
    
    // Write detailed report
    const reportFile = 'performance-analysis-report.json';
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📄 Performance analysis report written to ${reportFile}`);
    
    // Generate human-readable summary
    this.generateSummaryReport(report);
  }

  /**
   * Generate human-readable summary
   */
  generateSummaryReport(report) {
    const lines = [];
    
    lines.push('# Performance Analysis Report');
    lines.push('');
    lines.push(`**Date:** ${new Date(report.timestamp).toLocaleString()}`);
    lines.push(`**Status:** ${report.summary.passed ? '✅ PASSED' : '❌ FAILED'}`);
    lines.push('');
    
    // Current metrics
    lines.push('## Current Performance Metrics');
    const current = report.current_results;
    if (current) {
      lines.push(`- **Median Response Time:** ${current.medianResponseTime}ms`);
      lines.push(`- **95th Percentile:** ${current.p95ResponseTime}ms`);
      lines.push(`- **99th Percentile:** ${current.p99ResponseTime}ms`);
      lines.push(`- **Error Rate:** ${current.errorRate.toFixed(2)}%`);
      lines.push(`- **Requests Per Second:** ${current.requestsPerSecond.toFixed(2)}`);
    }
    lines.push('');
    
    // Baseline comparison
    if (report.baseline_results) {
      lines.push('## Baseline Comparison');
      const baseline = report.baseline_results;
      lines.push(`- **Median Response Time:** ${baseline.medianResponseTime}ms → ${current.medianResponseTime}ms`);
      lines.push(`- **Error Rate:** ${baseline.errorRate.toFixed(2)}% → ${current.errorRate.toFixed(2)}%`);
      lines.push(`- **Requests Per Second:** ${baseline.requestsPerSecond.toFixed(2)} → ${current.requestsPerSecond.toFixed(2)}`);
      lines.push('');
    }
    
    // Violations
    if (report.violations.length > 0) {
      lines.push('## Threshold Violations');
      report.violations.forEach(violation => {
        lines.push(`- **${violation.metric}:** ${violation.value}${violation.unit} exceeds threshold of ${violation.threshold}${violation.unit}`);
      });
      lines.push('');
    }
    
    // Regressions
    if (report.regressions.length > 0) {
      lines.push('## Performance Regressions');
      report.regressions.forEach(regression => {
        const sign = regression.changePercent >= 0 ? '+' : '';
        lines.push(`- **${regression.metric}:** ${sign}${regression.changePercent.toFixed(2)}% change (${regression.current}${regression.unit} vs ${regression.baseline}${regression.unit})`);
      });
      lines.push('');
    }
    
    // Recommendations
    lines.push('## Recommendations');
    if (report.summary.passed) {
      lines.push('- Performance is within acceptable limits');
      lines.push('- Continue monitoring for trends');
    } else {
      lines.push('- Investigate performance degradation');
      lines.push('- Consider optimization before deployment');
      if (report.regressions.length > 0) {
        lines.push('- Compare with previous versions to identify changes');
      }
    }
    
    const summaryFile = 'performance-summary.md';
    fs.writeFileSync(summaryFile, lines.join('\n'));
    
    console.log(`📋 Performance summary written to ${summaryFile}`);
  }

  /**
   * Extract key metrics from results
   */
  extractKeyMetrics(results) {
    const aggregate = results.aggregate;
    if (!aggregate) return null;
    
    const counters = aggregate.counters || {};
    const errorRate = this.calculateErrorRate(counters);
    const requestsPerSecond = (aggregate.rates && aggregate.rates['http.request_rate']) || 0;
    
    return {
      medianResponseTime: (aggregate.latency && aggregate.latency.median) || 0,
      p95ResponseTime: (aggregate.latency && aggregate.latency.p95) || 0,
      p99ResponseTime: (aggregate.latency && aggregate.latency.p99) || 0,
      errorRate: errorRate,
      requestsPerSecond: requestsPerSecond,
      totalRequests: counters['http.requests'] || 0
    };
  }

  /**
   * Update baseline with current results if they pass
   */
  async updateBaseline() {
    try {
      const baselineData = {
        timestamp: new Date().toISOString(),
        aggregate: this.results.aggregate,
        version: process.env.GITHUB_SHA || 'unknown',
        branch: process.env.GITHUB_REF_NAME || 'unknown'
      };
      
      fs.writeFileSync(BASELINE_FILE, JSON.stringify(baselineData, null, 2));
      console.log(`📊 Updated performance baseline: ${BASELINE_FILE}`);
      
    } catch (error) {
      console.warn('⚠️ Failed to update baseline:', error.message);
    }
  }

  /**
   * Print failure details
   */
  printFailures() {
    console.log('\n💥 Performance Check Failures:');
    console.log('================================');
    
    if (this.violations.length > 0) {
      console.log('\n📊 Threshold Violations:');
      this.violations.forEach((violation, index) => {
        console.log(`${index + 1}. ${violation.metric}`);
        console.log(`   Current: ${violation.value}${violation.unit}`);
        console.log(`   Threshold: ${violation.threshold}${violation.unit}`);
        console.log(`   Required: ${violation.comparison.replace('_', ' ')} threshold`);
        console.log('');
      });
    }
    
    if (this.regressions.length > 0) {
      console.log('📈 Performance Regressions:');
      this.regressions.forEach((regression, index) => {
        const sign = regression.changePercent >= 0 ? '+' : '';
        console.log(`${index + 1}. ${regression.metric}`);
        console.log(`   Current: ${regression.current}${regression.unit}`);
        console.log(`   Baseline: ${regression.baseline}${regression.unit}`);
        console.log(`   Change: ${sign}${regression.changePercent.toFixed(2)}%`);
        console.log(`   Threshold: ±${regression.thresholdPercent}%`);
        console.log('');
      });
    }
  }
}

// Main execution
if (require.main === module) {
  const reportFile = process.argv[2];
  
  if (!reportFile) {
    console.error('❌ Usage: node check-performance-regression.js <artillery-report.json>');
    process.exit(1);
  }
  
  const checker = new PerformanceChecker();
  checker.run(reportFile);
}