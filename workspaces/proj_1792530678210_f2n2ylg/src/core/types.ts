/**
 * Core Type Definitions for PortfolioHub
 * Provides strict typing and robust data contracts across the application.
 */

/**
 * Represents the operational mode or theme of the portfolio.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Represents a navigational link within the application.
 */
export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly external?: boolean;
}

/**
 * Represents a single project showcased in the portfolio.
 */
export interface Project {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly longDescription?: string;
  readonly technologies: readonly string[];
  readonly repositoryUrl?: string;
  readonly liveUrl?: string;
  readonly imageUrl: string;
  readonly featured: boolean;
  readonly createdAt: string;
}

/**
 * Represents professional work experience or education.
 */
export interface Milestone {
  readonly id: string;
  readonly role: string;
  readonly organization: string;
  readonly location: string;
  readonly startDate: string;
  readonly endDate: string | 'Present';
  readonly description: readonly string[];
  readonly skills: readonly string[];
}

/**
 * Represents user profile and metadata information.
 */
export interface UserProfile {
  readonly name: string;
  readonly title: string;
  readonly bio: string;
  readonly avatarUrl: string;
  readonly email: string;
  readonly location: string;
  readonly socialLinks: Readonly<Record<string, string>>;
}

/**
 * Contact form payload structure.
 */
export interface ContactMessage {
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly message: string;
  readonly timestamp: string;
}

/**
 * Generic API response wrapper for standardized error handling.
 */
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}
