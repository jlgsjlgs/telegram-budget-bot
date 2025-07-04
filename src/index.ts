// Telegram Budget Bot - Cloudflare Worker (Enhanced with Categories)
// Environment variables needed:
// - BOT_TOKEN: Your Telegram bot token
// - WEBHOOK_SECRET: Secret for webhook validation
// - AUTHORIZED_USERS: Comma-separated list of user IDs (e.g., "123456789,987654321")
// - APPS_SCRIPT_URL: Your deployed Google Apps Script web app URL
// - SHARED_SECRET: Secret for further authentication in HTTP header

interface Env {
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  AUTHORIZED_USERS: string;
  APPS_SCRIPT_URL: string;
  SHARED_SECRET: string;
}

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  text: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface ExpenseData {
  category: string;
  description: string;
  paymentMode: string;
  amount: number;
}

interface AppsScriptResponse {
  success: boolean;
  error?: string;
  data?: {
    date: string;
    formattedCategory: string;
    description: string;
    formattedPaymentMode: string;
    amount: number;
    sheetName: string;
  };
}

class TelegramBudgetBot {
  private botToken: string;
  private authorizedUsers: number[];
  private appsScriptUrl: string;
  private sharedSecret: string;
  
  // Predefined categories - keep in sync with Google Apps Script
  private readonly VALID_CATEGORIES = [
    'food',
    'transport',
    'shopping',
    'entertainment',
    'healthcare',
    'others'
  ];

  constructor(env: Env) {
    this.botToken = env.BOT_TOKEN;
    this.authorizedUsers = env.AUTHORIZED_USERS.split(',').map(id => parseInt(id.trim()));
    this.appsScriptUrl = env.APPS_SCRIPT_URL;
    this.sharedSecret = env.SHARED_SECRET;
  }

  // Verify webhook authenticity using secret token
  private verifyWebhook(request: Request, secret: string): boolean {
    const telegramToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    return telegramToken === secret;
  }

  // Check if user is authorized
  private isAuthorized(userId: number): boolean {
    return this.authorizedUsers.includes(userId);
  }

  // Send message back to Telegram
  private async sendMessage(chatId: number, text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
        }),
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  // Validate category
  private isValidCategory(category: string): boolean {
    return this.VALID_CATEGORIES.includes(category.toLowerCase());
  }

  // Get categories list formatted for display
  private getCategoriesText(): string {
    return this.VALID_CATEGORIES.map((cat, index) => 
      `${index + 1}. ${cat}`
    ).join('\n');
  }

  // Parse expense input from user message
  private parseExpenseInput(text: string): ExpenseData | null {
    // Remove the /expense command
    const input = text.replace('/expense', '').trim();
    
    // Split by pipe delimiter
    const parts = input.split('|').map(part => part.trim());
    
    if (parts.length !== 4) {
      return null;
    }

    const [category, description, paymentMode, amountStr] = parts;
    const amount = parseFloat(amountStr);

    if (isNaN(amount) || amount <= 0) {
      return null;
    }

    // Validate category
    if (!this.isValidCategory(category)) {
      return null;
    }

    return {
      category,
      description,
      paymentMode,
      amount,
    };
  }

  // Add expense via Google Apps Script
  private async addExpenseToSheet(userId: number, expenseData: ExpenseData): Promise<AppsScriptResponse> {
    try {
      const response = await fetch(this.appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          category: expenseData.category,
          description: expenseData.description,
          paymentMode: expenseData.paymentMode,
          amount: expenseData.amount,
          appKey: this.sharedSecret
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error calling Apps Script:', error);
      return {
        success: false,
        error: 'Failed to connect to spreadsheet service'
      };
    }
  }

  // Handle incoming Telegram updates
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (!update.message || !update.message.text) {
      return;
    }

    const message = update.message;
    const userId = message.from.id;
    const chatId = message.from.id;
    const text = message.text;

    // Check authorization
    if (!this.isAuthorized(userId)) {
      console.log(`Unauthorized access attempt from user ID: ${userId}`);
      return; // Silently ignore unauthorized users
    }

    // Handle commands
    if (text === '/start') {
      await this.sendMessage(chatId, 
        `🏦 <b>Personal Budget Bot</b>\n\n` +
        `Welcome! I'll help you track your expenses.\n\n` +
        `<b>Available Commands:</b>\n` +
        `• /expense - Add new expense\n` +
        `• /categories - View valid categories\n` +
        `• /help - Show detailed help\n\n` +
        `<b>Quick Example:</b>\n` +
        `/expense Food | Lunch Chicken Rice | Cash | 5\n\n` +
        `📊 Your data is automatically organized by month in Google Sheets!`
      );
      return;
    }

    if (text === '/categories') {
      await this.sendMessage(chatId,
        `📋 <b>Valid Categories</b>\n\n` +
        `${this.getCategoriesText()}\n\n`
      );
      return;
    }

    if (text === '/help') {
      await this.sendMessage(chatId,
        `<b>Commands:</b>\n` +
        `/start - Show welcome message\n` +
        `/categories - Show valid categories\n` +
        `/help - Show this help\n` +
        `/expense - Add new expense\n\n` +
        `<b>Expense Format:</b>\n` +
        `Category | Description | Payment Mode | Amount\n\n` +
        `<b>Examples:</b>\n` +
        `• /expense Food | Coffee and pastry | Cash | 8.50\n` +
        `• /expense Transport | Uber to airport | Card | 25.00\n` +
        `• /expense Shopping | Groceries | Card | 67.89\n\n` +
        `💡 <b>Tips:</b>\n` +
        `• Use /categories to see valid categories\n` +
        `• Date is added automatically\n` +
        `• All expenses are marked as non-recurring by default\n` +
        `• Data is organized by month (e.g., "07/25" for July 2025)`
      );
      return;
    }

    if (text.startsWith('/expense')) {
      const expenseData = this.parseExpenseInput(text);
      
      if (!expenseData) {
        const input = text.replace('/expense', '').trim();
        const parts = input.split('|').map(part => part.trim());
        
        // Check if it's a category validation issue
        if (parts.length === 4 && !this.isValidCategory(parts[0])) {
          await this.sendMessage(chatId,
            `❌ <b>Invalid Category!</b>\n\n` +
            `"${parts[0]}" is not a valid category.\n\n` +
            `Use /categories to see all valid options.\n\n` +
            `<b>Valid categories:</b>\n` +
            `${this.VALID_CATEGORIES.join(', ')}`
          );
          return;
        }
        
        await this.sendMessage(chatId,
          `❌ <b>Invalid format!</b>\n\n` +
          `Please use: /expense Category | Description | Payment Mode | Amount\n\n` +
          `<b>Example:</b>\n` +
          `/expense Food | Lunch at cafe | Credit Card | 15.50\n\n` +
          `Make sure to:\n` +
          `• Use pipe symbols (|) to separate fields\n` +
          `• Include all 4 fields\n` +
          `• Use a valid category (see /categories)\n` +
          `• Use a valid number for amount`
        );
        return;
      }

      // Show processing message
      await this.sendMessage(chatId, `⏳ Processing your expense...`);

      // Add to Google Sheets via Apps Script
      const result = await this.addExpenseToSheet(userId, expenseData);
      
      if (result.success && result.data) {
        await this.sendMessage(chatId,
          `✅ <b>Expense Added Successfully!</b>\n\n` +
          `📅 Date: ${result.data.date}\n` +
          `🏷️ Category: ${result.data.formattedCategory}\n` +
          `📝 Description: ${result.data.description}\n` +
          `💳 Payment: ${result.data.formattedPaymentMode}\n` +
          `💰 Amount: $${result.data.amount.toFixed(2)}\n` +
          `🔄 Recurring: No\n` +
          `📊 Sheet: ${result.data.sheetName}\n\n` +
          `Your expense has been logged! 🎉`
        );
      } else {
        await this.sendMessage(chatId,
          `❌ <b>Error Adding Expense</b>\n\n` +
          `${result.error || 'Unknown error occurred'}\n\n`
        );
      }
      return;
    }

    // Handle unknown commands
    await this.sendMessage(chatId,
      `❓ <b>Unknown command</b>\n\n` +
      `I didn't recognize that command. Here's what I can do:\n\n` +
      `• /start - Get started\n` +
      `• /categories - View valid categories\n` +
      `• /help - Show detailed help\n` +
      `• /expense - Add a new expense\n\n` +
      `Type /help for detailed usage instructions.`
    );
  }
}

// Cloudflare Worker fetch handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only handle POST requests (Telegram webhooks)
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Initialize bot
      const bot = new TelegramBudgetBot(env);
      
      // Verify webhook (optional - you can enable this for extra security)
      if (env.WEBHOOK_SECRET && !bot['verifyWebhook'](request, env.WEBHOOK_SECRET)) {
        console.log('Webhook verification failed');
        return new Response('Unauthorized', { status: 401 });
      }

      // Parse the update
      const update: TelegramUpdate = await request.json();
      
      // Handle the update
      await bot.handleUpdate(update);
      
      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Error processing update:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
