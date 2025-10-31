#!/usr/bin/env node

/**
 * MockMCPClient - Reusable MCP Client for Testing
 *
 * Provides a clean async API for testing MCP servers by:
 * - Spawning the server as a child process
 * - Handling stdio communication
 * - Managing JSON-RPC request/response cycles
 * - Supporting both tool calls and protocol methods
 *
 * Based on test-generic-search.js implementation.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MockMCPClient {
  constructor(serverPath = null) {
    this.serverPath = serverPath || path.join(__dirname, '..', '..', 'dist', 'index.js');
    this.process = null;
    this.requestId = 1;
    this.responseHandlers = new Map();
    this.buffer = '';
    this.initialized = false;
  }

  /**
   * Start the MCP server and initialize the connection
   */
  async start() {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Starting MCP server: ${this.serverPath}`);

      this.process = spawn('node', [this.serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Handle stdout data
      this.process.stdout.on('data', (data) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      // Handle stderr
      this.process.stderr.on('data', (data) => {
        // Ignore non-error stderr (like "Rechtsinformationen MCP server running on stdio")
        const message = data.toString();
        if (!message.includes('running on stdio')) {
          console.error(`Server stderr: ${message}`);
        }
      });

      // Handle process errors
      this.process.on('error', (error) => {
        console.error(`Failed to start server: ${error}`);
        reject(error);
      });

      // Initialize the connection
      setTimeout(async () => {
        try {
          await this.sendRequest('initialize', {
            protocolVersion: '0.1.0',
            capabilities: {},
            clientInfo: {
              name: 'mock-mcp-client',
              version: '1.0.0',
            },
          });

          // Send initialized notification
          await this.sendNotification('notifications/initialized');

          this.initialized = true;
          console.log(`✅ MCP server initialized`);
          resolve();
        } catch (error) {
          reject(error);
        }
      }, 500);
    });
  }

  /**
   * Process incoming buffer data and handle JSON-RPC responses
   */
  processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);

        if (message.id && this.responseHandlers.has(message.id)) {
          const handler = this.responseHandlers.get(message.id);
          this.responseHandlers.delete(message.id);

          if (message.error) {
            handler.reject(new Error(message.error.message || 'Unknown error'));
          } else {
            handler.resolve(message.result);
          }
        }
      } catch (error) {
        // Ignore parse errors for partial messages
      }
    }
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  async sendRequest(method, params, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const id = this.requestId++;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.responseHandlers.set(id, { resolve, reject });

      this.process.stdin.write(JSON.stringify(request) + '\n');

      // Timeout handling
      setTimeout(() => {
        if (this.responseHandlers.has(id)) {
          this.responseHandlers.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, timeout);
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  async sendNotification(method, params = {}) {
    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.process.stdin.write(JSON.stringify(notification) + '\n');
  }

  /**
   * List available tools
   */
  async listTools() {
    return await this.sendRequest('tools/list', {});
  }

  /**
   * Call a tool with given arguments
   */
  async callTool(toolName, args) {
    return await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    });
  }

  /**
   * Stop the MCP server
   */
  async stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.initialized = false;
    }
  }

  /**
   * Check if the client is initialized and ready
   */
  isReady() {
    return this.initialized && this.process !== null;
  }

  /**
   * Get list of available tool names
   */
  async getToolNames() {
    const result = await this.listTools();
    return result.tools.map(t => t.name);
  }

  /**
   * Get tool definition by name
   */
  async getToolDefinition(toolName) {
    const result = await this.listTools();
    return result.tools.find(t => t.name === toolName);
  }
}

export default MockMCPClient;
