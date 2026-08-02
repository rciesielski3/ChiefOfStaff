/**
 * Shared types for GitHub API integrations
 */

/**
 * GitHub Search API response structure
 */
export interface GitHubSearchResponse {
  items: GitHubRepository[];
  total_count: number;
}

/**
 * GitHub repository from search API
 */
export interface GitHubRepository {
  id: number;
  full_name: string;
  html_url: string;
  description?: string;
  created_at: string;
  updated_at: string;
  stargazers_count: number;
  topics: string[];
}
