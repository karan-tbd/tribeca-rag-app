# Agent Document Management

## Overview

The Agent Configuration UI now includes integrated document management functionality, allowing users to upload and manage PDF documents directly within each agent's configuration page.

## Features

### Document Upload
- **File Type Validation**: Only PDF files are accepted
- **Size Limit**: Maximum file size of 50MB
- **Progress Feedback**: Real-time upload status with success/error messages
- **Automatic Processing**: Documents are automatically processed for search after upload

### Document Management
- **Document List**: View all documents associated with an agent
- **Document Metadata**: Display document title, upload date, and version
- **Document Deletion**: Remove documents with confirmation dialog
- **Real-time Updates**: Document list updates automatically after operations

### Integration
- **Agent-Scoped**: Documents are linked to specific agents via `agent_id`
- **User-Scoped**: Users can only see and manage their own documents (RLS enforced)
- **Storage**: Files stored in Supabase Storage with organized folder structure
- **Database**: Document metadata tracked in `documents` table

## Technical Implementation

### Components

#### AgentDocuments Component
- **Location**: `src/components/agents/AgentDocuments.tsx`
- **Props**: `agentId: string | null`
- **Features**:
  - File upload with validation
  - Document listing with metadata
  - Delete functionality with confirmation
  - Loading states and error handling

#### Integration with AgentConfigForm
- **Location**: `src/components/agents/AgentConfigForm.tsx`
- **Enhancement**: Added `<AgentDocuments>` component below the configuration form
- **Conditional Display**: Shows "Save agent first" message when no agent is selected

### Database Schema

```sql
-- Documents are linked to agents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime TEXT DEFAULT 'application/pdf',
  latest_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Storage Structure
```
documents/
  {user_id}/
    {timestamp}-{filename}.pdf
```

### API Integration

#### Upload Flow
1. **File Validation**: Check file type and size
2. **Storage Upload**: Upload to Supabase Storage
3. **Database Record**: Create document record with metadata
4. **Processing**: Trigger document processing via Edge Function
5. **UI Update**: Refresh document list

#### Delete Flow
1. **Confirmation**: User confirms deletion
2. **Storage Cleanup**: Remove file from Supabase Storage
3. **Database Cleanup**: Delete document record
4. **UI Update**: Remove from document list

## User Experience

### Workflow
1. **Create/Select Agent**: User creates or selects an existing agent
2. **Configure Agent**: Set up agent parameters (name, prompts, models, etc.)
3. **Upload Documents**: Add PDF documents to provide knowledge base
4. **Manage Documents**: View, organize, and delete documents as needed

### UI Layout
```
Agent Configuration
├── Agent Form (name, description, prompts, models)
└── Documents Section
    ├── Upload Area (file input + upload button)
    ├── Document Count Header
    └── Document List
        └── Document Item (title, date, version, delete button)
```

### States
- **No Agent Selected**: Shows "Save agent first" message
- **Loading**: Shows loading indicator while fetching documents
- **Empty State**: Shows helpful message when no documents exist
- **Document List**: Shows documents with metadata and actions
- **Uploading**: Shows upload progress and disables upload button

## Security

### Row-Level Security (RLS)
- Users can only access documents where `user_id = auth.uid()`
- Documents are automatically scoped to the authenticated user
- Storage policies enforce user-based access control

### File Validation
- **Type Checking**: Only `application/pdf` MIME type allowed
- **Size Limits**: 50MB maximum file size
- **Path Security**: Files stored with user ID prefix to prevent access conflicts

## Testing

### Test Coverage
- **Component Rendering**: Verify UI renders correctly for different states
- **File Upload**: Test successful upload flow with validation
- **File Validation**: Test error handling for invalid files
- **Document Management**: Test document listing and deletion
- **User Interactions**: Test user actions and state changes

### Test File
- **Location**: `tests/agent_documents.test.tsx`
- **Mocking**: Supabase client, auth provider, and toast notifications
- **Scenarios**: Upload success/failure, validation errors, deletion flow

## Future Enhancements

### Planned Features
- **Drag & Drop**: Enhanced upload UX with drag-and-drop interface
- **Multiple File Upload**: Batch upload multiple PDFs
- **Document Preview**: View document content within the UI
- **Version Management**: Handle document updates and versioning
- **Search**: Search within uploaded documents
- **Document Types**: Support for additional file formats (Word, text, etc.)

### Performance Optimizations
- **Chunked Upload**: For large files to improve reliability
- **Lazy Loading**: Load documents on demand for better performance
- **Caching**: Cache document metadata for faster loading
- **Compression**: Optimize file storage and transfer

## Migration Notes

### Existing Users
- No migration required - feature is additive
- Existing agents will show empty document state
- Users can immediately start uploading documents

### Database Changes
- No schema changes required - tables already exist
- Storage bucket already configured with proper RLS policies
- Edge functions already handle document processing

## Troubleshooting

### Common Issues
1. **Upload Fails**: Check file size and type, verify storage bucket permissions
2. **Documents Not Loading**: Verify RLS policies and user authentication
3. **Processing Errors**: Check Edge Function logs for document processing issues
4. **Permission Errors**: Ensure user has proper access to storage bucket

### Debug Steps
1. Check browser console for JavaScript errors
2. Verify Supabase client configuration
3. Test storage bucket access manually
4. Review RLS policies in Supabase dashboard
