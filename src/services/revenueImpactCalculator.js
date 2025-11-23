/**
 * Revenue Impact Calculator
 * Calculate and project revenue impact from A/B tests
 */

const { loggingService } = require('./loggingService');

class RevenueImpactCalculator {
  /**
   * Calculate revenue impact from test results
   */
  async calculateImpact(testResults, businessMetrics) {
    const { control, variants } = this.parseResults(testResults);

    if (!control) {
      throw new Error('Control variant not found');
    }

    const impacts = [];

    for (const variant of variants) {
      const impact = this.calculateVariantImpact(control, variant, businessMetrics);
      impacts.push({
        variantId: variant.id,
        ...impact
      });
    }

    return {
      baseline: this.calculateBaseline(control, businessMetrics),
      variants: impacts,
      bestVariant: this.findBestVariant(impacts)
    };
  }

  /**
   * Parse test results into control and variants
   */
  parseResults(testResults) {
    const control = testResults.results?.control;
    const variants = Object.entries(testResults.results || {})
      .filter(([id]) => id !== 'control')
      .map(([id, data]) => ({ id, ...data }));

    return { control, variants };
  }

  /**
   * Calculate impact for a single variant vs control
   */
  calculateVariantImpact(control, variant, businessMetrics) {
    const {
      monthlyUsers = 10000,
      avgOrderValue = 10
    } = businessMetrics;

    // Current metrics
    const currentConversionRate = control.conversionRate / 100;
    const currentMonthlyRevenue = monthlyUsers * currentConversionRate * avgOrderValue;

    // Variant metrics
    const variantConversionRate = variant.conversionRate / 100;
    const variantMonthlyRevenue = monthlyUsers * variantConversionRate * avgOrderValue;

    // Impact calculations
    const absoluteIncrease = variantMonthlyRevenue - currentMonthlyRevenue;
    const percentIncrease = ((variantMonthlyRevenue - currentMonthlyRevenue) / currentMonthlyRevenue) * 100;

    // Projections
    const monthlyImpact = absoluteIncrease;
    const quarterlyImpact = absoluteIncrease * 3;
    const annualImpact = absoluteIncrease * 12;

    // Customer lifetime value impact
    const avgLifetimeMonths = 12; // Assumed average customer lifetime
    const lifetimeValueImpact = absoluteIncrease * avgLifetimeMonths;

    return {
      current: {
        conversionRate: control.conversionRate,
        monthlyRevenue: parseFloat(currentMonthlyRevenue.toFixed(2)),
        annualRevenue: parseFloat((currentMonthlyRevenue * 12).toFixed(2))
      },
      variant: {
        conversionRate: variant.conversionRate,
        monthlyRevenue: parseFloat(variantMonthlyRevenue.toFixed(2)),
        annualRevenue: parseFloat((variantMonthlyRevenue * 12).toFixed(2))
      },
      impact: {
        absoluteIncrease: parseFloat(absoluteIncrease.toFixed(2)),
        percentIncrease: parseFloat(percentIncrease.toFixed(2)),
        monthly: parseFloat(monthlyImpact.toFixed(2)),
        quarterly: parseFloat(quarterlyImpact.toFixed(2)),
        annual: parseFloat(annualImpact.toFixed(2)),
        lifetimeValue: parseFloat(lifetimeValueImpact.toFixed(2))
      },
      roi: {
        implementationCost: 0, // Software changes typically have no marginal cost
        timeToROI: 'immediate',
        roi: 'infinite'
      },
      confidence: variant.confidence || 0
    };
  }

  /**
   * Calculate baseline metrics
   */
  calculateBaseline(control, businessMetrics) {
    const {
      monthlyUsers = 10000,
      avgOrderValue = 10
    } = businessMetrics;

    const conversionRate = control.conversionRate / 100;
    const monthlyRevenue = monthlyUsers * conversionRate * avgOrderValue;

    return {
      monthlyUsers,
      conversionRate: control.conversionRate,
      avgOrderValue,
      monthlyRevenue: parseFloat(monthlyRevenue.toFixed(2)),
      annualRevenue: parseFloat((monthlyRevenue * 12).toFixed(2))
    };
  }

  /**
   * Find best performing variant
   */
  findBestVariant(impacts) {
    if (impacts.length === 0) {
      return null;
    }

    let best = impacts[0];

    for (const impact of impacts) {
      // Consider both revenue impact and statistical confidence
      const currentScore = impact.impact.annual * (impact.confidence / 100);
      const bestScore = best.impact.annual * (best.confidence / 100);

      if (currentScore > bestScore) {
        best = impact;
      }
    }

    return {
      variantId: best.variantId,
      annualImpact: best.impact.annual,
      confidence: best.confidence,
      recommendation: this.getRecommendation(best)
    };
  }

  /**
   * Get recommendation based on impact
   */
  getRecommendation(impact) {
    if (impact.confidence < 90) {
      return 'Continue test - insufficient confidence';
    }

    if (impact.impact.percentIncrease < 5) {
      return 'Marginal improvement - consider new variants';
    }

    if (impact.impact.percentIncrease >= 20) {
      return 'MAJOR WIN - Rollout immediately';
    }

    if (impact.impact.percentIncrease >= 10) {
      return 'Significant improvement - Rollout recommended';
    }

    return 'Modest improvement - Consider rollout';
  }

  /**
   * Simulate revenue scenarios
   */
  async simulateScenarios(testResults, scenarioInputs) {
    const scenarios = [];

    for (const input of scenarioInputs) {
      const impact = await this.calculateImpact(testResults, {
        monthlyUsers: input.users,
        avgOrderValue: input.avgOrderValue
      });

      scenarios.push({
        name: input.name,
        assumptions: {
          monthlyUsers: input.users,
          avgOrderValue: input.avgOrderValue
        },
        ...impact
      });
    }

    return scenarios;
  }

  /**
   * Calculate payback period for feature development
   */
  calculatePaybackPeriod(annualImpact, developmentCost) {
    if (developmentCost === 0) {
      return 'immediate';
    }

    const monthlyImpact = annualImpact / 12;
    const months = developmentCost / monthlyImpact;

    if (months < 1) {
      return 'less than 1 month';
    }

    return `${Math.ceil(months)} months`;
  }

  /**
   * Generate revenue optimization report
   */
  async generateReport(testId, testResults, businessMetrics) {
    try {
      const impact = await this.calculateImpact(testResults, businessMetrics);

      const report = {
        testId,
        testName: testResults.name,
        generatedAt: new Date().toISOString(),
        executiveSummary: this.generateExecutiveSummary(impact),
        baseline: impact.baseline,
        variants: impact.variants,
        recommendation: impact.bestVariant,
        scenarios: await this.generateScenarios(testResults)
      };

      return report;
    } catch (error) {
      loggingService.log('error', `Error generating revenue report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate executive summary
   */
  generateExecutiveSummary(impact) {
    if (!impact.bestVariant) {
      return {
        status: 'inconclusive',
        message: 'No variant shows significant improvement over control'
      };
    }

    const best = impact.variants.find(v => v.variantId === impact.bestVariant.variantId);

    return {
      status: 'actionable',
      winner: impact.bestVariant.variantId,
      improvement: `+${best.impact.percentIncrease.toFixed(1)}%`,
      annualImpact: `$${best.impact.annual.toLocaleString()}`,
      confidence: `${impact.bestVariant.confidence}%`,
      recommendation: impact.bestVariant.recommendation
    };
  }

  /**
   * Generate different revenue scenarios
   */
  async generateScenarios(testResults) {
    const scenarios = [
      { name: 'Conservative', users: 5000, avgOrderValue: 8 },
      { name: 'Current', users: 10000, avgOrderValue: 10 },
      { name: 'Growth', users: 20000, avgOrderValue: 12 },
      { name: 'Aggressive', users: 50000, avgOrderValue: 15 }
    ];

    return await this.simulateScenarios(testResults, scenarios);
  }

  /**
   * Calculate cumulative revenue impact over time
   */
  calculateCumulativeImpact(monthlyImpact, months) {
    const cumulative = [];
    let total = 0;

    for (let i = 1; i <= months; i++) {
      total += monthlyImpact;
      cumulative.push({
        month: i,
        monthlyImpact: parseFloat(monthlyImpact.toFixed(2)),
        cumulativeImpact: parseFloat(total.toFixed(2))
      });
    }

    return cumulative;
  }

  /**
   * Compare multiple tests
   */
  async compareTests(testResults) {
    const comparisons = [];

    for (const test of testResults) {
      const impact = await this.calculateImpact(test, {
        monthlyUsers: 10000,
        avgOrderValue: 10
      });

      comparisons.push({
        testId: test.testId,
        testName: test.name,
        bestVariant: impact.bestVariant,
        annualImpact: impact.bestVariant ?
          impact.variants.find(v => v.variantId === impact.bestVariant.variantId).impact.annual :
          0
      });
    }

    // Sort by annual impact
    comparisons.sort((a, b) => b.annualImpact - a.annualImpact);

    return {
      tests: comparisons,
      totalPotentialImpact: comparisons.reduce((sum, c) => sum + c.annualImpact, 0),
      topOpportunity: comparisons[0]
    };
  }
}

module.exports = new RevenueImpactCalculator();
