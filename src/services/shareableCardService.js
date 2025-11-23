/**
 * SHAREABLE CARD GENERATION SERVICE
 *
 * Creates beautiful social media cards with:
 * - Instagram Square (1080x1080)
 * - Instagram Story (1080x1920)
 * - Twitter/X (1200x675)
 * - Facebook (1200x630)
 *
 * Features:
 * - Overlay zodiac symbols
 * - Add inspirational text
 * - User branding
 * - Watermark "Created with Cosmic Coach"
 * - Download in multiple formats
 */

const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./loggingService');
const imageGenerationService = require('./imageGenerationService');

class ShareableCardService {
  constructor() {
    // Social media dimensions
    this.dimensions = {
      instagram_square: { width: 1080, height: 1080 },
      instagram_story: { width: 1080, height: 1920 },
      twitter: { width: 1200, height: 675 },
      facebook: { width: 1200, height: 630 }
    };

    // Zodiac symbols (Unicode)
    this.zodiacSymbols = {
      aries: '♈',
      taurus: '♉',
      gemini: '♊',
      cancer: '♋',
      leo: '♌',
      virgo: '♍',
      libra: '♎',
      scorpio: '♏',
      sagittarius: '♐',
      capricorn: '♑',
      aquarius: '♒',
      pisces: '♓'
    };

    // Card templates
    this.templates = {
      daily_energy: this.createDailyEnergyCard.bind(this),
      compatibility: this.createCompatibilityCard.bind(this),
      moon_ritual: this.createMoonRitualCard.bind(this),
      avatar: this.createAvatarCard.bind(this)
    };
  }

  /**
   * CREATE SHAREABLE CARD FOR ANY IMAGE
   */
  async createShareableCard(imageId, format = 'instagram_square', options = {}) {
    try {
      // Get image data
      const imageData = await imageGenerationService.getImageById(imageId);
      if (!imageData) {
        throw new Error('Image not found');
      }

      // Select template based on category
      const template = this.templates[imageData.category] || this.createGenericCard.bind(this);

      // Generate card
      const cardBuffer = await template(imageData, format, options);

      return {
        success: true,
        buffer: cardBuffer,
        format,
        dimensions: this.dimensions[format]
      };

    } catch (error) {
      logger.error('Shareable card creation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * CREATE DAILY ENERGY CARD
   */
  async createDailyEnergyCard(imageData, format, options = {}) {
    const { width, height } = this.dimensions[format];
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load background image
    const backgroundImage = await loadImage(imageData.image_url);

    // Draw background (fill entire canvas)
    ctx.drawImage(backgroundImage, 0, 0, width, height);

    // Add dark overlay for text readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    const metadata = imageData.metadata;

    // Top: Zodiac symbol and sign
    if (metadata.sign) {
      const symbol = this.zodiacSymbols[metadata.sign.toLowerCase()];
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${width * 0.1}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(symbol, width / 2, height * 0.15);

      ctx.font = `${width * 0.05}px Arial`;
      ctx.fillText(metadata.sign.toUpperCase(), width / 2, height * 0.22);
    }

    // Middle: Date
    if (metadata.date) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `${width * 0.04}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(metadata.date, width / 2, height * 0.5);
    }

    // Bottom: Energy level indicator
    if (metadata.energyLevel) {
      const energyText = `Energy: ${metadata.energyLevel}/10`;
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${width * 0.035}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(energyText, width / 2, height * 0.8);
    }

    // Watermark
    this.addWatermark(ctx, width, height);

    return canvas.toBuffer('image/png');
  }

  /**
   * CREATE COMPATIBILITY CARD
   */
  async createCompatibilityCard(imageData, format, options = {}) {
    const { width, height } = this.dimensions[format];
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load background
    const backgroundImage = await loadImage(imageData.image_url);
    ctx.drawImage(backgroundImage, 0, 0, width, height);

    // Add overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    const metadata = imageData.metadata;

    // Top: Signs
    if (metadata.user1Sign && metadata.user2Sign) {
      const symbol1 = this.zodiacSymbols[metadata.user1Sign.toLowerCase()];
      const symbol2 = this.zodiacSymbols[metadata.user2Sign.toLowerCase()];

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${width * 0.08}px Arial`;
      ctx.textAlign = 'center';

      // Sign 1
      ctx.fillText(symbol1, width * 0.3, height * 0.15);
      ctx.font = `${width * 0.04}px Arial`;
      ctx.fillText(metadata.user1Sign, width * 0.3, height * 0.22);

      // Heart or plus symbol
      ctx.font = `${width * 0.06}px Arial`;
      ctx.fillStyle = '#FF69B4';
      ctx.fillText('♥', width * 0.5, height * 0.17);

      // Sign 2
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${width * 0.08}px Arial`;
      ctx.fillText(symbol2, width * 0.7, height * 0.15);
      ctx.font = `${width * 0.04}px Arial`;
      ctx.fillText(metadata.user2Sign, width * 0.7, height * 0.22);
    }

    // Center: Compatibility score
    if (metadata.compatibilityScore !== undefined) {
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${width * 0.12}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(`${metadata.compatibilityScore}%`, width / 2, height * 0.5);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `${width * 0.035}px Arial`;
      ctx.fillText('COMPATIBILITY', width / 2, height * 0.57);
    }

    this.addWatermark(ctx, width, height);

    return canvas.toBuffer('image/png');
  }

  /**
   * CREATE MOON RITUAL CARD
   */
  async createMoonRitualCard(imageData, format, options = {}) {
    const { width, height } = this.dimensions[format];
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const backgroundImage = await loadImage(imageData.image_url);
    ctx.drawImage(backgroundImage, 0, 0, width, height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    const metadata = imageData.metadata;

    // Top: Moon phase
    if (metadata.moonPhase) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${width * 0.06}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(metadata.moonPhase.toUpperCase(), width / 2, height * 0.15);
    }

    // Middle: Intention
    if (metadata.intention) {
      ctx.fillStyle = '#FFD700';
      ctx.font = `${width * 0.045}px Arial`;
      ctx.textAlign = 'center';
      const lines = this.wrapText(ctx, metadata.intention, width * 0.8);
      lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, height * 0.5 + (index * width * 0.05));
      });
    }

    this.addWatermark(ctx, width, height);

    return canvas.toBuffer('image/png');
  }

  /**
   * CREATE AVATAR CARD
   */
  async createAvatarCard(imageData, format, options = {}) {
    const { width, height } = this.dimensions[format];
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const backgroundImage = await loadImage(imageData.image_url);
    ctx.drawImage(backgroundImage, 0, 0, width, height);

    const metadata = imageData.metadata;

    // Add gradient overlay at bottom
    const gradient = ctx.createLinearGradient(0, height * 0.7, 0, height);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, height * 0.7, width, height * 0.3);

    // Bottom: Birth chart info
    if (metadata.sunSign) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `${width * 0.035}px Arial`;
      ctx.textAlign = 'center';

      const chartText = `☉ ${metadata.sunSign} • ☽ ${metadata.moonSign} • ↑ ${metadata.risingSign}`;
      ctx.fillText(chartText, width / 2, height * 0.9);
    }

    this.addWatermark(ctx, width, height);

    return canvas.toBuffer('image/png');
  }

  /**
   * CREATE GENERIC CARD (FALLBACK)
   */
  async createGenericCard(imageData, format, options = {}) {
    const { width, height } = this.dimensions[format];
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const backgroundImage = await loadImage(imageData.image_url);
    ctx.drawImage(backgroundImage, 0, 0, width, height);

    this.addWatermark(ctx, width, height);

    return canvas.toBuffer('image/png');
  }

  /**
   * ADD WATERMARK
   */
  addWatermark(ctx, width, height) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = `${width * 0.025}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('Created with Cosmic Coach', width / 2, height * 0.97);
  }

  /**
   * TEXT WRAPPING UTILITY
   */
  wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + word + ' ';
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine !== '') {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine = testLine;
      }
    }

    lines.push(currentLine.trim());
    return lines;
  }

  /**
   * CREATE ALL FORMATS AT ONCE
   */
  async createAllFormats(imageId, options = {}) {
    try {
      const formats = Object.keys(this.dimensions);
      const results = {};

      for (const format of formats) {
        const card = await this.createShareableCard(imageId, format, options);
        if (card.success) {
          results[format] = card.buffer;
        }
      }

      return {
        success: true,
        formats: results
      };

    } catch (error) {
      logger.error('Multi-format card generation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * SAVE CARD TO FILE
   */
  async saveCardToFile(cardBuffer, filename, directory = '/tmp/shareable_cards') {
    try {
      // Ensure directory exists
      await fs.mkdir(directory, { recursive: true });

      const filepath = path.join(directory, filename);
      await fs.writeFile(filepath, cardBuffer);

      return {
        success: true,
        filepath
      };

    } catch (error) {
      logger.error('Card save failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new ShareableCardService();
