const fs = require('fs');
const path = require('path');
const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

function isKebabCase(str) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(str);
}

async function sync_single_notion_page(pageId) {
  if (!pageId) {
    console.error('❌ NOTION_PAGE_ID is missing.');
    process.exit(1);
  }

  let page;
  try {
    page = await notion.pages.retrieve({ page_id: pageId });
  } catch (err) {
    console.error('❌ Failed to fetch page from Notion API:', err.message || err);
    process.exit(1);
  }
  const title = page.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
  const blogUrlTitle = page.properties?.['Blog URL title']?.rich_text?.[0]?.plain_text;
  const category = page.properties?.['Category']?.select?.name;
  const date = new Date(new Date(page.created_time).getTime() + 9 * 60 * 60 * 1000)
                 .toISOString().replace('T', ' ').substring(0, 19);

  if (!blogUrlTitle || !isKebabCase(blogUrlTitle)) {
    console.error(`❌ Invalid Blog URL title: must be kebab-case. Got "${blogUrlTitle}"`);
    process.exit(1);
  }

  if (!['Develop', 'Diary'].includes(category)) {
    console.error(`❌ Invalid Category: must be "Develop" or "Diary". Got "${category}"`);
    process.exit(1);
  }

  const mdBlocks = await n2m.pageToMarkdown(pageId);
  const { parent: mdStringRaw } = n2m.toMarkdownString(mdBlocks);

  // Add <br> tag between markdown headings
  const mdString = mdStringRaw
    .replace(/(^|\n)(#+ .+?)\n/g, '$1$2\n<br>\n')
    .replace(/\n\n    /g, '\n    ');

  const filename = `${blogUrlTitle}.md`;
  const filepath = path.join(__dirname, 'source/_posts', filename);

  let finalDate = date;

  if (fs.existsSync(filepath)) {
    const existingContent = fs.readFileSync(filepath, 'utf-8');
    const dateMatch = existingContent.match(/^date:\s*(.+)$/m);
    if (dateMatch) {
      finalDate = dateMatch[1].trim();
      console.log(`📝 Updating existing post. Preserving date: ${finalDate}`);
    }
  }

  const frontmatter = `---\ntitle: '${title}'\ndate: ${finalDate}\ncategories:\n  - ${category}\n---\n\n`;

  fs.writeFileSync(filepath, frontmatter + mdString);
  console.log(`✅ Markdown post created: ${filepath}`);
  console.log(`filename=${filename}`);
}

async function sync_recent_notion_pages(databaseId, limit = 10) {
  if (!databaseId) {
    console.error('❌ NOTION_DATABASE_ID is missing.');
    process.exit(1);
  }

  let pages;
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: limit,
    });
    pages = response.results;
  } catch (err) {
    console.error('❌ Failed to query Notion database:', err.message || err);
    process.exit(1);
  }

  for (const page of pages) {
    await sync_single_notion_page(page.id);
  }
}

async function main() {
  await sync_recent_notion_pages(DATABASE_ID);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});