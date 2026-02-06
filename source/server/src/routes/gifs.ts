import { Router } from 'express';

const router = Router();

// Giphy API configuration
// Using public beta key for now - replace with production key via env var
const GIPHY_API_KEY = process.env.GIPHY_API_KEY || 'dc6zaTOxFJmzC';
const GIPHY_API_URL = 'https://api.giphy.com/v1/gifs';

// Get trending GIFs
router.get('/trending', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const response = await fetch(
      `${GIPHY_API_URL}/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&offset=${offset}&rating=pg-13`
    );

    if (!response.ok) {
      console.error('Giphy API error:', response.status, response.statusText);
      return res.status(response.status).json({ error: 'Failed to fetch trending GIFs' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching trending GIFs:', error);
    res.status(500).json({ error: 'Failed to fetch GIFs' });
  }
});

// Search GIFs
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const response = await fetch(
      `${GIPHY_API_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&rating=pg-13`
    );

    if (!response.ok) {
      console.error('Giphy API error:', response.status, response.statusText);
      return res.status(response.status).json({ error: 'Failed to search GIFs' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error searching GIFs:', error);
    res.status(500).json({ error: 'Failed to search GIFs' });
  }
});

export default router;
