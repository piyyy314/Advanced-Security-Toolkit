import { getAccessToken } from './googleDriveAuth';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  shared?: boolean;
  owners?: Array<{
    displayName: string;
    emailAddress: string;
    photoLink?: string;
  }>;
}

export interface DriveActivityItem {
  timestamp: string;
  action: string;
  actor: string;
  targetTitle: string;
  targetMimeType: string;
}

/**
 * List files from Google Drive
 */
export async function listGoogleDriveFiles(params: {
  folderId?: string;
  searchTerm?: string;
  mimeTypeFilter?: string;
  pageSize?: number;
  pageToken?: string;
  orderBy?: string;
}): Promise<{ files: DriveFileItem[]; nextPageToken?: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authentication required: No active Google Drive access token found.');
  }

  const queryParts: string[] = ['trashed = false'];

  if (params.folderId) {
    queryParts.push(`'${params.folderId}' in parents`);
  }

  if (params.searchTerm && params.searchTerm.trim() !== '') {
    const escaped = params.searchTerm.replace(/'/g, "\\'");
    queryParts.push(`(name contains '${escaped}' or fullText contains '${escaped}')`);
  }

  if (params.mimeTypeFilter && params.mimeTypeFilter !== 'all') {
    if (params.mimeTypeFilter === 'folder') {
      queryParts.push("mimeType = 'application/vnd.google-apps.folder'");
    } else if (params.mimeTypeFilter === 'document') {
      queryParts.push("(mimeType = 'application/vnd.google-apps.document' or mimeType contains 'text/' or mimeType contains 'application/json' or name contains '.yar' or name contains '.smt2' or name contains '.py')");
    } else if (params.mimeTypeFilter === 'security_evidence') {
      queryParts.push("(name contains '.json' or name contains '.log' or name contains '.yar' or name contains '.smt2' or name contains '.exe' or name contains '.bin')");
    }
  }

  const q = encodeURIComponent(queryParts.join(' and '));
  const fields = encodeURIComponent('nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, iconLink, thumbnailLink, parents, shared, owners)');
  const pageSize = params.pageSize || 30;
  const orderBy = encodeURIComponent(params.orderBy || 'folder,modifiedTime desc');

  let url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=${pageSize}&orderBy=${orderBy}`;
  if (params.pageToken) {
    url += `&pageToken=${encodeURIComponent(params.pageToken)}`;
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Google Drive API error (${res.status})`);
  }

  const data = await res.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken
  };
}

/**
 * Fetch raw file content / text for inspection & analysis
 */
export async function getGoogleDriveFileContent(fileId: string, mimeType: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authentication required to read file content.');
  }

  let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  // If it's a Google Doc, export as plain text
  if (mimeType === 'application/vnd.google-apps.document') {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to fetch file content (${res.status})`);
  }

  return await res.text();
}

/**
 * Upload a file directly to Google Drive (Multipart upload)
 */
export async function uploadGoogleDriveFile(options: {
  name: string;
  content: string | Blob;
  mimeType: string;
  folderId?: string;
  description?: string;
}): Promise<DriveFileItem> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authentication required to upload to Google Drive.');
  }

  const metadata: any = {
    name: options.name,
    mimeType: options.mimeType,
    description: options.description || 'Uploaded from Aegis Security & Forensics Toolkit'
  };

  if (options.folderId) {
    metadata.parents = [options.folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const bodyContent = typeof options.content === 'string' ? options.content : await options.content.text();

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${options.mimeType}\r\n\r\n` +
    bodyContent +
    closeDelimiter;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to upload file to Google Drive (${res.status})`);
  }

  return await res.json();
}

/**
 * Create a new folder in Google Drive
 */
export async function createGoogleDriveFolder(name: string, parentFolderId?: string): Promise<DriveFileItem> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authentication required to create folder.');
  }

  const metadata: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder'
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,createdTime,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to create folder (${res.status})`);
  }

  return await res.json();
}

/**
 * Delete a file or folder from Google Drive
 */
export async function deleteGoogleDriveFile(fileId: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Authentication required to delete file.');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to delete file (${res.status})`);
  }

  return true;
}

/**
 * Query Drive Activity API (using drive.activity scope)
 */
export async function queryGoogleDriveActivity(pageSize = 15): Promise<DriveActivityItem[]> {
  const token = await getAccessToken();
  if (!token) {
    return [];
  }

  try {
    const res = await fetch('https://driveactivity.googleapis.com/v2/activity:query', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pageSize
      })
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const activities: DriveActivityItem[] = [];

    if (data.activities && Array.isArray(data.activities)) {
      for (const act of data.activities) {
        const time = act.timestamp || (act.timeRange ? act.timeRange.endTime : new Date().toISOString());
        const primaryActionName = act.primaryActionDetail ? Object.keys(act.primaryActionDetail)[0] : 'modified';
        let actorName = 'User';
        if (act.actors && act.actors[0] && act.actors[0].user && act.actors[0].user.knownUser) {
          actorName = act.actors[0].user.knownUser.personName || 'User';
        }
        let targetTitle = 'Drive Item';
        let targetMimeType = '';
        if (act.targets && act.targets[0] && act.targets[0].driveItem) {
          targetTitle = act.targets[0].driveItem.title || 'Drive Item';
          targetMimeType = act.targets[0].driveItem.mimeType || '';
        }

        activities.push({
          timestamp: time,
          action: primaryActionName.replace(/([A-Z])/g, ' $1').toLowerCase(),
          actor: actorName,
          targetTitle,
          targetMimeType
        });
      }
    }

    return activities;
  } catch (err) {
    console.warn('Drive Activity query non-fatal failure:', err);
    return [];
  }
}
