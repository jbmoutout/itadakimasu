import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { prisma } from '../../lib/prisma';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const recipeId = searchParams.get('recipeId');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    console.log('Fetching metadata for URL:', url);
    
    const { metadata, originUrl } = await fetchMetadata(url);
    
    if (recipeId) {
      try {
        await prisma.recipe.update({
          where: { id: parseInt(recipeId) },
          data: {
            title: metadata.title || null,
            description: metadata.description || null,
            image: metadata.image || null,
            ...(originUrl && { originUrl })
          }
        });
      } catch (dbError) {
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
        return NextResponse.json(
          { error: 'Database update failed', details: errorMessage },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      title: metadata.title || null,
      description: metadata.description || null,
      image: metadata.image || null,
      originUrl: originUrl || null
    });
  } catch (error) {
    console.error('Detailed error in preview-metadata route:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      url: url
    });
    
    return NextResponse.json({
      error: 'Failed to fetch or process metadata',
      details: error instanceof Error ? error.message : 'Unknown error',
      url: url
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

const getFullImageUrl = (imgSrc: string | undefined, baseUrl: string) => {
  if (!imgSrc) return null;
  try {
    return new URL(imgSrc, baseUrl).href;
  } catch {
    return null;
  }
};

async function fetchMetadata(url: string) {
  try {
    console.log('Starting fetchMetadata for:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)',
      },
      signal: AbortSignal.timeout(10000)
    });
    
    console.log('Fetch response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log('Received HTML length:', html.length);
    
    if (!html) {
      throw new Error('Empty HTML response');
    }
    
    const $ = cheerio.load(html);
    
    // Check for WPRM print view and "Go Back" button
    if (url.includes('/wprm_print/')) {
      const backButton = $('a:contains("Go Back")');
      if (backButton.length) {
        const originUrl = backButton.attr('href');
        if (originUrl) {
          console.log('Found Go Back URL:', originUrl);
          
          // Fetch metadata from the original URL
          const originResponse = await fetch(originUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)',
            },
            signal: AbortSignal.timeout(10000)
          });
          
          if (!originResponse.ok) {
            throw new Error(`HTTP error on origin URL! status: ${originResponse.status}`);
          }
          
          const originHtml = await originResponse.text();
          const origin$ = cheerio.load(originHtml);
          
          const metadata = {
            title: origin$('meta[property="og:title"]').attr('content') || 
                   origin$('title').text() || 
                   null,
            description: origin$('meta[property="og:description"]').attr('content') || 
                        origin$('meta[name="description"]').attr('content') || 
                        null,
            image: origin$('meta[property="og:image"]').attr('content') || 
                   null
          };
          
          console.log('Extracted metadata from origin URL:', metadata);
          return { metadata, originUrl };
        }
      }
    } 
    
    // If not a print view or no Go Back button found, extract metadata from current page
    const metadata = {
      title: $('meta[property="og:title"]').attr('content') || 
             $('meta[name="twitter:title"]').attr('content') ||
             $('title').text() || 
             null,
      description: $('meta[property="og:description"]').attr('content') || 
                  $('meta[name="twitter:description"]').attr('content') ||
                  $('meta[name="description"]').attr('content') || 
                  null,
      image: $('meta[property="og:image"]').attr('content') ||
             $('meta[name="twitter:image"]').attr('content') ||
             getFullImageUrl($('img').not('[src*="logo"], [class*="logo"], [alt*="logo"]').first().attr('src'), url) ||
            null
    };
    
    console.log('Extracted metadata:', metadata);
    return { metadata, originUrl: null };
  } catch (error) {
    console.error('Error in fetchMetadata:', error);
    throw error;
  }
}