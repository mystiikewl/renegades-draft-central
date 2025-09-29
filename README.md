# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/48e0680f-4f94-426d-9c66-7df916907973

## Documentation

Additional project documentation can be found in the [`/documentation`](../documentation) directory, including:

- Product Requirements Document
- Code quality analysis and issue tracking
- Technical documentation for various components
- Known issues and troubleshooting guides
- **Production Readiness Plan and Summary**

## Recent Improvements

### Supabase Types Refactoring

The monolithic Supabase types file has been refactored into a modular structure for better maintainability:
- Separate files for each database table type
- Separate files for each RPC function type
- Backward compatibility maintained

### Production Readiness Enhancements

Recent work has focused on preparing the application for production deployment:

1. **Code Quality Improvements**
   - Fixed all critical ESLint errors
   - Resolved useEffect and useCallback dependency warnings
   - Reduced ESLint issues from 3 errors/11 warnings to 1 error/8 warnings

2. **Testing Framework Implementation**
   - Set up Vitest with React Testing Library
   - Created 13 passing tests covering critical user flows (expanded from initial 8)
   - Added test scripts for development and CI/CD

3. **CI/CD Pipeline**
   - Implemented GitHub Actions workflow for automated testing
   - Configured ESLint, testing, and build verification in CI pipeline

4. **Security Enhancements**
   - Implemented proper environment variable management
   - Replaced hardcoded credentials with environment variables
   - Added validation for required configuration

5. **Documentation**
   - Created comprehensive user guide
   - Developed API documentation for Supabase integration
   - Wrote admin/developer guide with deployment and maintenance procedures
   - Documented security enhancements

For detailed information about these improvements, see the documentation in the [`/documentation`](../documentation) directory.

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/48e0680f-4f94-426d-9c66-7df916907973) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/48e0680f-4f94-426d-9c66-7df916907973) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
