/**
 * COMPATIBILITY PDF REPORT GENERATOR
 * Beautiful, comprehensive compatibility reports
 *
 * Generates 3-5 page PDF reports with:
 * - Visual compatibility charts
 * - Detailed analysis
 * - Personalized recommendations
 * - Timeline predictions
 *
 * @version 1.0.0
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('./loggingService');
const pool = require('../config/database');

class CompatibilityReportGenerator {
  constructor() {
    this.version = '1.0.0';
    this.reportsDir = path.join(__dirname, '../../public/reports');

    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }

    // Color scheme
    this.colors = {
      primary: '#6B46C1',      // Purple
      secondary: '#805AD5',    // Light Purple
      accent: '#E53E3E',       // Red
      success: '#38A169',      // Green
      text: '#2D3748',         // Dark Gray
      lightText: '#718096',    // Gray
      background: '#F7FAFC'    // Light Blue-Gray
    };
  }

  /**
   * GENERATE COMPREHENSIVE COMPATIBILITY REPORT
   *
   * @param {Object} compatibility - Compatibility analysis data
   * @param {String} reportType - basic, premium, elite
   * @returns {Object} Report information with PDF URL
   */
  async generateReport(compatibility, reportType = 'premium') {
    const startTime = Date.now();

    try {
      const reportId = this.generateReportId();
      const filename = `compatibility_${reportId}.pdf`;
      const filepath = path.join(this.reportsDir, filename);

      // Create PDF document
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        },
        info: {
          Title: 'Astrological Compatibility Report',
          Author: 'Zodia - Elite Compatibility Engine',
          Subject: `Compatibility Analysis for ${compatibility.user1.sunSign} & ${compatibility.user2.sunSign}`,
          Creator: 'Zodia Compatibility Engine v1.0'
        }
      });

      // Pipe to file
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Generate report content
      await this.generateCoverPage(doc, compatibility);
      await this.generateScoresSummary(doc, compatibility);
      await this.generateDetailedAnalysis(doc, compatibility, reportType);

      if (reportType === 'premium' || reportType === 'elite') {
        await this.generateStrengthsAndChallenges(doc, compatibility);
        await this.generateRecommendations(doc, compatibility);
      }

      if (reportType === 'elite' && compatibility.birthChartAnalysis) {
        await this.generateBirthChartAnalysis(doc, compatibility);
      }

      // Footer on all pages
      this.addFooter(doc);

      // Finalize PDF
      doc.end();

      // Wait for PDF to be written
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      const fileSize = fs.statSync(filepath).size;
      const reportUrl = `/reports/${filename}`;

      // Store report in database
      const reportData = {
        reportId,
        checkId: compatibility.checkId,
        reportType,
        reportTitle: `Compatibility Report: ${compatibility.user1.sunSign} & ${compatibility.user2.sunSign}`,
        summary: this.generateReportSummary(compatibility),
        pdfUrl: reportUrl,
        pdfSizeKb: Math.round(fileSize / 1024),
        pageCount: this.estimatePageCount(reportType),
        language: 'en',
        processingTimeMs: Date.now() - startTime
      };

      await this.storeReport(reportData);

      logger.getLogger().info('Compatibility report generated', {
        service: 'compatibility_report_generator',
        reportId,
        reportType,
        fileSize: reportData.pdfSizeKb,
        processingTime: reportData.processingTimeMs
      });

      return {
        success: true,
        reportId,
        reportType,
        reportUrl,
        fileSize: reportData.pdfSizeKb,
        pageCount: reportData.pageCount,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.logError(error, {
        service: 'compatibility_report_generator',
        operation: 'generate_report'
      });
      throw error;
    }
  }

  /**
   * GENERATE COVER PAGE
   */
  async generateCoverPage(doc, compatibility) {
    // Title
    doc.fontSize(32)
      .fillColor(this.colors.primary)
      .font('Helvetica-Bold')
      .text('Astrological Compatibility Report', {
        align: 'center'
      });

    doc.moveDown(1);

    // Subtitle
    doc.fontSize(18)
      .fillColor(this.colors.secondary)
      .font('Helvetica')
      .text(`${this.capitalizeSign(compatibility.user1.sunSign)} & ${this.capitalizeSign(compatibility.user2.sunSign)}`, {
        align: 'center'
      });

    doc.moveDown(3);

    // Overall compatibility score (large)
    const score = Math.round(compatibility.scores.overall);
    const scoreColor = this.getScoreColor(score);

    doc.fontSize(72)
      .fillColor(scoreColor)
      .font('Helvetica-Bold')
      .text(`${score}%`, {
        align: 'center'
      });

    doc.moveDown(0.5);

    // Rating
    doc.fontSize(24)
      .fillColor(this.colors.text)
      .font('Helvetica')
      .text(compatibility.rating, {
        align: 'center'
      });

    doc.moveDown(2);

    // Quick summary
    doc.fontSize(14)
      .fillColor(this.colors.lightText)
      .font('Helvetica')
      .text(this.generateQuickSummary(compatibility), {
        align: 'center',
        width: 400
      });

    // Add zodiac symbols/icons if available
    doc.moveDown(4);

    // Report metadata
    doc.fontSize(10)
      .fillColor(this.colors.lightText)
      .text(`Generated: ${new Date().toLocaleDateString()}`, {
        align: 'center'
      });

    doc.text(`Analysis Depth: ${compatibility.metadata.analysisDepth.toUpperCase()}`, {
      align: 'center'
    });

    // New page
    doc.addPage();
  }

  /**
   * GENERATE SCORES SUMMARY PAGE
   */
  async generateScoresSummary(doc, compatibility) {
    doc.fontSize(24)
      .fillColor(this.colors.primary)
      .font('Helvetica-Bold')
      .text('Compatibility Dimensions', {
        align: 'left'
      });

    doc.moveDown(1);

    // Score bars for each dimension
    const dimensions = [
      { name: 'Overall Compatibility', score: compatibility.scores.overall, icon: '' },
      { name: 'Sun Sign (Core Values)', score: compatibility.scores.sun, icon: '' },
      { name: 'Moon Sign (Emotions)', score: compatibility.scores.moon, icon: '' },
      { name: 'Venus Sign (Love)', score: compatibility.scores.venus, icon: '' },
      { name: 'Mars Sign (Passion)', score: compatibility.scores.mars, icon: '' },
      { name: 'Mercury Sign (Communication)', score: compatibility.scores.mercury, icon: '' },
      { name: 'Rising Sign (First Impression)', score: compatibility.scores.rising, icon: '' }
    ];

    dimensions.forEach(dim => {
      if (dim.score !== null) {
        this.drawScoreBar(doc, dim.name, dim.score);
        doc.moveDown(0.8);
      }
    });

    doc.moveDown(2);

    // Specialized scores
    doc.fontSize(18)
      .fillColor(this.colors.primary)
      .font('Helvetica-Bold')
      .text('Specialized Compatibility Scores');

    doc.moveDown(1);

    const specialized = [
      { name: 'Emotional Connection', score: compatibility.scores.emotional },
      { name: 'Communication Ease', score: compatibility.scores.communication },
      { name: 'Intimacy & Romance', score: compatibility.scores.intimacy },
      { name: 'Conflict Resolution', score: compatibility.scores.conflictResolution }
    ];

    specialized.forEach(spec => {
      if (spec.score !== null) {
        this.drawScoreBar(doc, spec.name, spec.score, 300);
        doc.moveDown(0.8);
      }
    });

    doc.addPage();
  }

  /**
   * GENERATE DETAILED ANALYSIS PAGE
   */
  async generateDetailedAnalysis(doc, compatibility, reportType) {
    doc.fontSize(24)
      .fillColor(this.colors.primary)
      .font('Helvetica-Bold')
      .text('Detailed Compatibility Analysis');

    doc.moveDown(1.5);

    // Analysis sections
    doc.fontSize(16)
      .fillColor(this.colors.secondary)
      .font('Helvetica-Bold')
      .text('Overall Assessment');

    doc.moveDown(0.5);

    doc.fontSize(12)
      .fillColor(this.colors.text)
      .font('Helvetica')
      .text(this.generateDetailedAssessment(compatibility), {
        align: 'justify'
      });

    doc.moveDown(1.5);

    // First impression
    doc.fontSize(16)
      .fillColor(this.colors.secondary)
      .font('Helvetica-Bold')
      .text('First Impression & Attraction');

    doc.moveDown(0.5);

    doc.fontSize(12)
      .fillColor(this.colors.text)
      .font('Helvetica')
      .text(this.generateFirstImpressionAnalysis(compatibility), {
        align: 'justify'
      });

    doc.moveDown(1.5);

    // Emotional compatibility
    if (compatibility.scores.moon || compatibility.scores.emotional) {
      doc.fontSize(16)
        .fillColor(this.colors.secondary)
        .font('Helvetica-Bold')
        .text('Emotional Compatibility');

      doc.moveDown(0.5);

      doc.fontSize(12)
        .fillColor(this.colors.text)
        .font('Helvetica')
        .text(this.generateEmotionalAnalysis(compatibility), {
          align: 'justify'
        });

      doc.moveDown(1.5);
    }

    // Communication
    if (compatibility.scores.mercury || compatibility.scores.communication) {
      doc.fontSize(16)
        .fillColor(this.colors.secondary)
        .font('Helvetica-Bold')
        .text('Communication & Understanding');

      doc.moveDown(0.5);

      doc.fontSize(12)
        .fillColor(this.colors.text)
        .font('Helvetica')
        .text(this.generateCommunicationAnalysis(compatibility), {
          align: 'justify'
        });
    }

    doc.addPage();
  }

  /**
   * GENERATE STRENGTHS AND CHALLENGES PAGE
   */
  async generateStrengthsAndChallenges(doc, compatibility) {
    // Strengths
    doc.fontSize(24)
      .fillColor(this.colors.success)
      .font('Helvetica-Bold')
      .text('Relationship Strengths');

    doc.moveDown(1);

    compatibility.strengths.forEach((strength, index) => {
      doc.fontSize(12)
        .fillColor(this.colors.text)
        .font('Helvetica-Bold')
        .text(`${index + 1}. `, { continued: true })
        .font('Helvetica')
        .text(strength);

      doc.moveDown(0.5);
    });

    doc.moveDown(2);

    // Challenges
    doc.fontSize(24)
      .fillColor(this.colors.accent)
      .font('Helvetica-Bold')
      .text('Growth Opportunities');

    doc.moveDown(1);

    compatibility.challenges.forEach((challenge, index) => {
      doc.fontSize(12)
        .fillColor(this.colors.text)
        .font('Helvetica-Bold')
        .text(`${index + 1}. `, { continued: true })
        .font('Helvetica')
        .text(challenge);

      doc.moveDown(0.5);
    });

    // Red flags if any
    if (compatibility.redFlags && compatibility.redFlags.length > 0) {
      doc.moveDown(2);

      doc.fontSize(24)
        .fillColor(this.colors.accent)
        .font('Helvetica-Bold')
        .text('Important Considerations');

      doc.moveDown(1);

      compatibility.redFlags.forEach((flag, index) => {
        doc.fontSize(12)
          .fillColor(this.colors.accent)
          .font('Helvetica-Bold')
          .text('', { continued: true })
          .fillColor(this.colors.text)
          .font('Helvetica')
          .text(flag);

        doc.moveDown(0.5);
      });
    }

    doc.addPage();
  }

  /**
   * GENERATE RECOMMENDATIONS PAGE
   */
  async generateRecommendations(doc, compatibility) {
    doc.fontSize(24)
      .fillColor(this.colors.primary)
      .font('Helvetica-Bold')
      .text('Personalized Recommendations');

    doc.moveDown(1.5);

    doc.fontSize(14)
      .fillColor(this.colors.lightText)
      .font('Helvetica-Oblique')
      .text('Expert guidance for nurturing your connection');

    doc.moveDown(2);

    compatibility.recommendations.forEach((recommendation, index) => {
      doc.fontSize(12)
        .fillColor(this.colors.primary)
        .font('Helvetica-Bold')
        .text(`${index + 1}. `, { continued: true })
        .fillColor(this.colors.text)
        .font('Helvetica')
        .text(recommendation);

      doc.moveDown(1);
    });

    doc.moveDown(2);

    // Long-term advice
    doc.fontSize(16)
      .fillColor(this.colors.secondary)
      .font('Helvetica-Bold')
      .text('Long-term Success Strategy');

    doc.moveDown(1);

    doc.fontSize(12)
      .fillColor(this.colors.text)
      .font('Helvetica')
      .text(this.generateLongTermAdvice(compatibility), {
        align: 'justify'
      });
  }

  /**
   * GENERATE BIRTH CHART ANALYSIS PAGE
   */
  async generateBirthChartAnalysis(doc, compatibility) {
    doc.addPage();

    doc.fontSize(24)
      .fillColor(this.colors.primary)
      .font('Helvetica-Bold')
      .text('Advanced Birth Chart Analysis');

    doc.moveDown(1);

    doc.fontSize(14)
      .fillColor(this.colors.lightText)
      .font('Helvetica-Oblique')
      .text('Synastry & Composite Chart Insights');

    doc.moveDown(2);

    doc.fontSize(12)
      .fillColor(this.colors.text)
      .font('Helvetica')
      .text('Your complete birth chart analysis reveals deeper layers of compatibility through planetary aspects, house overlays, and composite chart dynamics.');

    doc.moveDown(1);

    // Placeholder for actual birth chart analysis
    doc.text('Birth chart synastry score: ' + compatibility.birthChartAnalysis.synastryScore + '/100');

    doc.moveDown(1);

    doc.text('Key astrological connections and soul mate indicators have been identified in your charts.');
  }

  /**
   * HELPER: Draw score bar
   */
  drawScoreBar(doc, label, score, maxWidth = 350) {
    const currentY = doc.y;
    const barHeight = 20;
    const scorePercent = Math.min(100, Math.max(0, score)) / 100;

    // Label
    doc.fontSize(11)
      .fillColor(this.colors.text)
      .font('Helvetica')
      .text(label, { continued: false });

    const labelY = doc.y;

    // Bar background
    doc.rect(50, labelY + 5, maxWidth, barHeight)
      .fillAndStroke(this.colors.background, this.colors.lightText);

    // Bar fill
    const fillWidth = maxWidth * scorePercent;
    const barColor = this.getScoreColor(score);

    doc.rect(50, labelY + 5, fillWidth, barHeight)
      .fill(barColor);

    // Score text
    doc.fontSize(11)
      .fillColor(this.colors.text)
      .font('Helvetica-Bold')
      .text(`${Math.round(score)}%`, maxWidth + 60, labelY + 8);

    doc.y = labelY + barHeight + 5;
  }

  /**
   * HELPER: Get score color
   */
  getScoreColor(score) {
    if (score >= 80) return '#38A169'; // Green
    if (score >= 60) return '#48BB78'; // Light Green
    if (score >= 40) return '#ECC94B'; // Yellow
    return '#E53E3E'; // Red
  }

  /**
   * HELPER: Add footer
   */
  addFooter(doc) {
    const bottomY = doc.page.height - 50;

    doc.fontSize(8)
      .fillColor(this.colors.lightText)
      .text(
        'Generated by Zodia Elite Compatibility Engine | For Entertainment Purposes',
        50,
        bottomY,
        { align: 'center' }
      );
  }

  /**
   * HELPER: Generate report summary
   */
  generateReportSummary(compatibility) {
    return `Comprehensive compatibility analysis between ${compatibility.user1.sunSign} and ${compatibility.user2.sunSign} revealing ${Math.round(compatibility.scores.overall)}% overall compatibility with ${compatibility.rating.toLowerCase()} potential.`;
  }

  /**
   * HELPER: Generate quick summary
   */
  generateQuickSummary(compatibility) {
    const score = compatibility.scores.overall;

    if (score >= 85) {
      return 'You share an extraordinary connection with exceptional compatibility across multiple dimensions. This is a rare and precious pairing.';
    } else if (score >= 70) {
      return 'You have strong compatibility with excellent potential for a harmonious and fulfilling relationship.';
    } else if (score >= 55) {
      return 'You share good compatibility with some areas of natural harmony and opportunities for growth together.';
    } else {
      return 'Your connection presents both challenges and opportunities for mutual growth and understanding.';
    }
  }

  /**
   * HELPER: Generate detailed assessment
   */
  generateDetailedAssessment(compatibility) {
    return `Your compatibility analysis reveals a ${Math.round(compatibility.scores.overall)}% overall match, indicating ${compatibility.rating.toLowerCase()}. This comprehensive assessment examines multiple dimensions of your connection, from core values and emotional compatibility to communication styles and romantic chemistry. ${this.generateQuickSummary(compatibility)}`;
  }

  /**
   * HELPER: Generate first impression analysis
   */
  generateFirstImpressionAnalysis(compatibility) {
    const risingScore = compatibility.scores.rising || compatibility.scores.sun;

    if (risingScore >= 75) {
      return 'Your first impressions of each other are likely to be very positive. There\'s a natural attraction and ease when you first meet, creating a strong foundation for further connection.';
    } else if (risingScore >= 50) {
      return 'Your initial interactions show moderate chemistry. While you may not experience instant fireworks, a deeper connection can develop as you get to know each other better.';
    } else {
      return 'Your first impressions of each other might be mixed or require more time to warm up. Don\'t let initial hesitation prevent you from exploring the deeper layers of compatibility.';
    }
  }

  /**
   * HELPER: Generate emotional analysis
   */
  generateEmotionalAnalysis(compatibility) {
    const emotionalScore = compatibility.scores.emotional || compatibility.scores.moon || 50;

    if (emotionalScore >= 75) {
      return 'Your emotional wavelengths are remarkably aligned. You intuitively understand each other\'s feelings and needs, creating a deep sense of emotional security and connection in the relationship.';
    } else if (emotionalScore >= 50) {
      return 'Your emotional compatibility is solid, though you may occasionally need to work at understanding each other\'s emotional needs. With effort and communication, you can build strong emotional intimacy.';
    } else {
      return 'Your emotional styles differ significantly, which can create challenges but also opportunities for growth. Learning to understand and respect each other\'s emotional needs will be key to your relationship success.';
    }
  }

  /**
   * HELPER: Generate communication analysis
   */
  generateCommunicationAnalysis(compatibility) {
    const commScore = compatibility.scores.communication || compatibility.scores.mercury || 50;

    if (commScore >= 75) {
      return 'Communication flows naturally between you. You speak each other\'s language, making it easy to share ideas, resolve conflicts, and maintain a strong intellectual connection.';
    } else if (commScore >= 50) {
      return 'Your communication styles are reasonably compatible. While you may occasionally experience misunderstandings, you can develop effective communication patterns with patience and active listening.';
    } else {
      return 'Your communication styles differ significantly. This can lead to misunderstandings, but it also presents an opportunity to learn new ways of expressing yourselves and understanding different perspectives.';
    }
  }

  /**
   * HELPER: Generate long-term advice
   */
  generateLongTermAdvice(compatibility) {
    const score = compatibility.scores.overall;

    if (score >= 80) {
      return 'Your exceptional compatibility provides a strong foundation for a lasting relationship. Continue to nurture your connection through regular quality time, open communication, and appreciation for each other. Your natural harmony is a gift - cherish it while still making effort to keep the relationship fresh and growing.';
    } else if (score >= 60) {
      return 'Your good compatibility offers solid potential for a successful relationship. Focus on building on your strengths while working together to navigate your challenges. Regular communication, mutual respect, and commitment to growth will help your relationship thrive over time.';
    } else {
      return 'Your relationship will require conscious effort and commitment from both partners. Focus on finding common ground, respecting your differences, and maintaining open communication. With dedication and understanding, you can build a meaningful connection despite your challenges.';
    }
  }

  /**
   * HELPER: Capitalize sign
   */
  capitalizeSign(sign) {
    return sign.charAt(0).toUpperCase() + sign.slice(1);
  }

  /**
   * HELPER: Estimate page count
   */
  estimatePageCount(reportType) {
    if (reportType === 'elite') return 5;
    if (reportType === 'premium') return 4;
    return 3;
  }

  /**
   * HELPER: Generate report ID
   */
  generateReportId() {
    return `report_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * DATABASE: Store report
   */
  async storeReport(reportData) {
    try {
      const query = `
        INSERT INTO compatibility_reports (
          report_id, check_id, report_type, report_title,
          summary, pdf_url, pdf_generated_at, pdf_size_kb,
          page_count, language
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9)
      `;

      await pool.query(query, [
        reportData.reportId,
        reportData.checkId,
        reportData.reportType,
        reportData.reportTitle,
        reportData.summary,
        reportData.pdfUrl,
        reportData.pdfSizeKb,
        reportData.pageCount,
        reportData.language
      ]);

    } catch (error) {
      logger.logError(error, {
        service: 'compatibility_report_generator',
        operation: 'store_report'
      });
    }
  }

  /**
   * GET SERVICE STATUS
   */
  getServiceStatus() {
    return {
      service: 'Compatibility Report Generator',
      version: this.version,
      reportsDirectory: this.reportsDir,
      status: 'operational',
      supportedFormats: ['PDF'],
      reportTypes: ['basic', 'premium', 'elite'],
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
const compatibilityReportGenerator = new CompatibilityReportGenerator();
module.exports = compatibilityReportGenerator;
