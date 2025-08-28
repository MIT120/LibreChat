import { Navigate } from 'react-router-dom';
import {
  PromptsView,
  PromptForm,
  CreatePromptForm,
  EmptyPromptPreview,
} from '~/components/Prompts';
// Book Creation Components
import WorkspaceDashboard from '~/components/Workspace/WorkspaceDashboard';
import WorkspaceOverview from '~/components/Workspace/WorkspaceOverview';
import EnhancedWritingEnvironment from '~/components/Writing/EnhancedWritingEnvironment';
import ScenePlanningBoard from '~/components/Planning/ScenePlanningBoard';
import TimelineView from '~/components/StoryPlanning/TimelineView';
import InteractiveBookPreview from '~/components/BookPreview/InteractiveBookPreview';
import StaticBookPreview from '~/components/BookPreview/StaticBookPreview';
import EnhancedBookPreview from '~/components/BookPreview/EnhancedBookPreview';
import DashboardRoute from './Layouts/Dashboard';

// Additional Book Creation Components
import BookLibrary from '~/components/BookCreation/BookLibrary';
import BookEditor from '~/components/BookCreation/BookEditor';
import OutlineEditor from '~/components/Planning/OutlineEditor';

// Placeholder components for missing views
const WorkspaceView = () => <div>Workspace View - Coming Soon</div>;
const WritingStudio = () => <div>Writing Studio - Coming Soon</div>;
const PlanningView = () => <div>Planning View - Coming Soon</div>;

const dashboardRoutes = {
  path: 'd/*',
  element: <DashboardRoute />,
  children: [
    {
      path: 'workspace/*',
      element: <WorkspaceDashboard />,
      children: [
        {
          index: true,
          element: <WorkspaceOverview />,
        },
        {
          path: ':workspaceId',
          element: <WorkspaceView />,
        },
      ],
    },
    {
      path: 'writing/*',
      element: <WritingStudio />,
      children: [
        {
          index: true,
          element: <EnhancedWritingEnvironment />,
        },
        {
          path: ':bookId',
          element: <EnhancedWritingEnvironment />,
        },
      ],
    },
    {
      path: 'planning/*',
      element: <PlanningView />,
      children: [
        {
          index: true,
          element: <ScenePlanningBoard />,
        },
        {
          path: 'scenes/:bookId',
          element: <ScenePlanningBoard />,
        },
        {
          path: 'timeline/:bookId',
          element: <TimelineView />,
        },
        {
          path: 'outline/:bookId',
          element: <OutlineEditor />,
        },
      ],
    },
    {
      path: 'books/*',
      element: <EnhancedBookPreview />,
      children: [
        {
          index: true,
          element: <BookLibrary />,
        },
        {
          path: 'preview',
          element: <StaticBookPreview />,
        },
        {
          path: ':bookId/preview',
          element: <InteractiveBookPreview />,
        },
        {
          path: ':bookId/edit',
          element: <BookEditor />,
        },
      ],
    },
    {
      path: 'prompts/*',
      element: <PromptsView />,
      children: [
        {
          index: true,
          element: <EmptyPromptPreview />,
        },
        {
          path: 'new',
          element: <CreatePromptForm />,
        },
        {
          path: ':promptId',
          element: <PromptForm />,
        },
      ],
    },
    {
      path: '*',
      element: <Navigate to="/d/workspace" replace={true} />,
    },
  ],
};

export default dashboardRoutes;
