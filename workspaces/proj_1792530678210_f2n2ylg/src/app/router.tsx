import React from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { HomePage } from '@/features/home/HomePage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { ProjectDetailPage } from '@/features/projects/ProjectDetailPage';
import { ContactPage } from '@/features/contact/ContactPage';
import { AdminDashboardPage } from '@/features/admin/AdminDashboardPage';
import { NotFoundPage } from '@/features/errors/NotFoundPage';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

/**
 * Root layout wrapper incorporating global error boundaries and primary application shell.
 */
const RootLayout: React.FC = () => {
  return (
    <ErrorBoundary>
      <MainLayout>
        <Outlet />
      </MainLayout>
    </ErrorBoundary>
  );
};

/**
 * Application router configuration using React Router v6 createBrowserRouter.
 * Defines all public routes, nested layouts, dynamic route parameters, and fallback handlers.
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'projects',
        element: <ProjectsPage />,
      },
      {
        path: 'projects/:id',
        element: <ProjectDetailPage />,
      },
      {
        path: 'contact',
        element: <ContactPage />,
      },
      {
        path: 'admin',
        element: <AdminDashboardPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);

/**
 * AppRouter component supplying the configured router instance to the React tree.
 */
export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};
