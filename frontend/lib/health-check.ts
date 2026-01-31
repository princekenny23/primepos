/**
 * Health Check Utility
 * 
 * Provides utilities to test backend connection and display helpful error messages
 */

import { apiConfig } from './api'

export interface HealthCheckResult {
  isHealthy: boolean
  message: string
  details?: {
    url: string
    timestamp: string
    error?: string
  }
}

/**
 * Check if the backend server is reachable
 * @param baseURL Optional base URL to test (defaults to configured API URL)
 * @returns Health check result with status and details
 */
export async function checkBackendHealth(baseURL?: string): Promise<HealthCheckResult> {
  const testURL = baseURL || apiConfig.baseURL
  const healthEndpoint = testURL.replace(/\/api\/v1$/, '/health/')
  
  console.log('🔍 Checking backend health:', healthEndpoint)
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(healthEndpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    })
    
    clearTimeout(timeoutId)
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Backend is healthy:', data)
      return {
        isHealthy: true,
        message: 'Backend server is running and accessible',
        details: {
          url: testURL,
          timestamp: new Date().toISOString(),
        },
      }
    } else {
      console.error('❌ Backend returned non-OK status:', response.status)
      return {
        isHealthy: false,
        message: `Backend server responded with status ${response.status}`,
        details: {
          url: testURL,
          timestamp: new Date().toISOString(),
          error: `HTTP ${response.status} ${response.statusText}`,
        },
      }
    }
  } catch (error) {
    console.error('❌ Backend health check failed:', error)
    
    let errorMessage = 'Unable to connect to the backend server'
    let troubleshooting = ''
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Backend health check timed out'
        troubleshooting = 'The server is taking too long to respond'
      } else if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        errorMessage = 'Cannot reach the backend server'
        troubleshooting = 'Network connection failed'
      } else {
        troubleshooting = error.message
      }
    }
    
    return {
      isHealthy: false,
      message: errorMessage,
      details: {
        url: testURL,
        timestamp: new Date().toISOString(),
        error: troubleshooting,
      },
    }
  }
}

/**
 * Test connection to localhost backend
 * Useful for development environment setup
 */
export async function checkLocalBackend(): Promise<HealthCheckResult> {
  return checkBackendHealth('http://localhost:8000/api/v1')
}

/**
 * Get troubleshooting steps based on the current environment
 */
export function getTroubleshootingSteps(): string[] {
  const isProduction = process.env.NODE_ENV === 'production'
  const apiUrl = apiConfig.baseURL
  
  if (isProduction) {
    return [
      '1. Verify the production backend server is running',
      `2. Check the URL: ${apiUrl}`,
      '3. Verify CORS settings allow requests from your frontend domain',
      '4. Check backend logs for errors',
      '5. Verify SSL certificates are valid (if using HTTPS)',
    ]
  }
  
  return [
    '1. Start the Django backend server:',
    '   cd backend && python manage.py runserver',
    '',
    '2. Verify the backend is running at: http://localhost:8000',
    '',
    '3. Check the health endpoint:',
    '   curl http://localhost:8000/health/',
    '',
    '4. Verify your .env.local file has:',
    '   NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1',
    '',
    '5. Restart the frontend server:',
    '   npm run dev',
    '',
    `Current API URL: ${apiUrl}`,
  ]
}

/**
 * Format health check result for display
 */
export function formatHealthCheckMessage(result: HealthCheckResult): string {
  if (result.isHealthy) {
    return `✅ ${result.message}\n\nConnected to: ${result.details?.url}`
  }
  
  const steps = getTroubleshootingSteps()
  const troubleshooting = steps.join('\n')
  
  return `❌ ${result.message}

${result.details?.error ? `Error: ${result.details.error}\n\n` : ''}Troubleshooting Steps:
${troubleshooting}

URL attempted: ${result.details?.url}
Time: ${result.details?.timestamp ? new Date(result.details.timestamp).toLocaleString() : 'N/A'}`
}

/**
 * Display health check results in console with formatting
 */
export function logHealthCheck(result: HealthCheckResult): void {
  const message = formatHealthCheckMessage(result)
  
  if (result.isHealthy) {
    console.log('%c' + message, 'color: green; font-weight: bold')
  } else {
    console.error('%c' + message, 'color: red; font-weight: bold')
  }
}
