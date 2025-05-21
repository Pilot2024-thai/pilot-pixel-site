import { Router } from 'itty-router'
import qs from 'qs'

const router = Router()

const DROPBOX_REFRESH_TOKEN = globalThis.DROPBOX_REFRESH_TOKEN
const DROPBOX_APP_KEY = globalThis.DROPBOX_APP_KEY
const DROPBOX_APP_SECRET = globalThis.DROPBOX_APP_SECRET
const DROPBOX_FOLDER_PATH = '/gallery'

async function getAccessToken() {
  const body = qs.stringify({
    grant_type: 'refresh_token',
    refresh_token: DROPBOX_REFRESH_TOKEN,
  })

  const res = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!res.ok) throw new Error('Failed to get access token')
  const data = await res.json()
  return data.access_token
}

async function listFiles(accessToken) {
  const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: DROPBOX_FOLDER_PATH }),
  })

  if (!res.ok) throw new Error('Failed to list folder')
  const data = await res.json()
  return data.entries.filter(e => e['.tag'] === 'file')
}

async function getSharedLink(accessToken, path) {
  const res = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  })

  if (res.status === 409) {
    const metadataRes = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, direct_only: true }),
    })
    const metaData = await metadataRes.json()
    if (metaData.links && metaData.links.length > 0) {
      return metaData.links[0].url.replace('?dl=0', '?raw=1')
    }
    return null
  }

  if (!res.ok) return null

  const data = await res.json()
  return data.url.replace('?dl=0', '?raw=1')
}

router.options('*', () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
})

router.get('/', async () => {
  try {
    const accessToken = await getAccessToken()
    const files = await listFiles(accessToken)
    const urls = await Promise.all(
      files.map(async (file) => {
        const url = await getSharedLink(accessToken, file.path_lower)
        return url
      })
    )
    return new Response(JSON.stringify(urls.filter(Boolean)), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return new Response(err.message || 'Internal Error', {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})

router.all('*', () => new Response('Not found.', { status: 404 }))

addEventListener('fetch', (event) => {
  event.respondWith(router.handle(event.request))  // ต้อง return Promise
})