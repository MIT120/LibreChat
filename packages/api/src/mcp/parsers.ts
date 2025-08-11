import type * as t from './types';
import type { ExtendedToolContentPart, ResourceLink } from './types';
const RECOGNIZED_PROVIDERS = new Set([
  'google',
  'anthropic',
  'openai',
  'openrouter',
  'xai',
  'deepseek',
  'ollama',
  'bedrock',
]);
const CONTENT_ARRAY_PROVIDERS = new Set(['google', 'anthropic', 'openai']);

const imageFormatters: Record<string, undefined | t.ImageFormatter> = {
  // google: (item) => ({
  //   type: 'image',
  //   inlineData: {
  //     mimeType: item.mimeType,
  //     data: item.data,
  //   },
  // }),
  // anthropic: (item) => ({
  //   type: 'image',
  //   source: {
  //     type: 'base64',
  //     media_type: item.mimeType,
  //     data: item.data,
  //   },
  // }),
  default: (item) => ({
    type: 'image_url',
    image_url: {
      url: item.data.startsWith('http') ? item.data : `data:${item.mimeType};base64,${item.data}`,
    },
  }),
};

function isImageContent(item: t.ToolContentPart): item is t.ImageContent {
  return item.type === 'image';
}

function parseAsString(result: t.MCPToolCallResponse): string {
  const content = result?.content ?? [];
  if (!content.length) {
    return '(No response)';
  }

  const text = content
    .map((item: ExtendedToolContentPart) => {
      if (item.type === 'text') {
        return item.text;
      }
      if (item.type === 'resource') {
        const resourceText = [];
        if (item.resource.text != null && item.resource.text) {
          resourceText.push(item.resource.text);
        }
        if (item.resource.uri) {
          resourceText.push(`Resource URI: ${item.resource.uri}`);
        }
        if (item.resource.name) {
          resourceText.push(`Resource: ${item.resource.name}`);
        }
        if (item.resource.description) {
          resourceText.push(`Description: ${item.resource.description}`);
        }
        if (item.resource.mimeType != null && item.resource.mimeType) {
          resourceText.push(`Type: ${item.resource.mimeType}`);
        }
        return resourceText.join('\n');
      }
      if (item.type === 'resource_link') {
        const link = item as ResourceLink;
        return [
          link.name ? `Resource: ${link.name}` : undefined,
          link.uri ? `Resource URI: ${link.uri}` : undefined,
        ]
          .filter(Boolean)
          .join('\n');
      }
      return JSON.stringify(item, null, 2);
    })
    .filter(Boolean)
    .join('\n\n');

  return text;
}

/**
 * Converts MCPToolCallResponse content into recognized content block types
 * Recognized types: "image", "image_url", "text", "json"
 *
 * @param {t.MCPToolCallResponse} result - The MCPToolCallResponse object
 * @param {string} provider - The provider name (google, anthropic, openai)
 * @returns {Array<Object>} Formatted content blocks
 */
/**
 * Converts MCPToolCallResponse content into recognized content block types
 * First element: string or formatted content (excluding image_url)
 * Second element: image_url content if any
 *
 * @param {t.MCPToolCallResponse} result - The MCPToolCallResponse object
 * @param {string} provider - The provider name (google, anthropic, openai)
 * @returns {t.FormattedContentResult} Tuple of content and image_urls
 */
export function formatToolContent(
  result: t.MCPToolCallResponse,
  provider: t.Provider,
): t.FormattedContentResult {
  if (!RECOGNIZED_PROVIDERS.has(provider)) {
    return [parseAsString(result), undefined];
  }

  const content = result?.content ?? [];
  if (!content.length) {
    return [[{ type: 'text', text: '(No response)' }], undefined];
  }

  const formattedContent: t.FormattedContent[] = [];
  const imageUrls: t.FormattedContent[] = [];
  let currentTextBlock = '';

  type ContentHandler = undefined | ((item: t.ToolContentPart) => void);

  const contentHandlers: {
    text: (item: Extract<t.ToolContentPart, { type: 'text' }>) => void;
    image: (item: t.ToolContentPart) => void;
    resource: (item: Extract<t.ToolContentPart, { type: 'resource' }>) => void;
    resource_link?: (item: ResourceLink) => void;
  } = {
    text: (item) => {
      currentTextBlock += (currentTextBlock ? '\n\n' : '') + item.text;
    },

    image: (item) => {
      if (!isImageContent(item)) {
        return;
      }
      if (CONTENT_ARRAY_PROVIDERS.has(provider) && currentTextBlock) {
        formattedContent.push({ type: 'text', text: currentTextBlock });
        currentTextBlock = '';
      }
      const formatter = imageFormatters.default as t.ImageFormatter;
      const formattedImage = formatter(item);

      if (formattedImage.type === 'image_url') {
        imageUrls.push(formattedImage);
      } else {
        formattedContent.push(formattedImage);
      }
    },

    resource: (item) => {
      // If the resource is an image or a direct URL/data URI, render it as an image_url artifact
      const mime = item.resource.mimeType ?? '';
      const uri = item.resource.uri ?? '';
      if (mime.startsWith('image/') || uri.startsWith('http') || uri.startsWith('data:image')) {
        imageUrls.push({
          type: 'image_url',
          image_url: { url: uri },
        } as t.FormattedContent);
        return;
      }

      // Otherwise, include a textual summary
      const resourceText = [] as string[];
      if (item.resource.text != null && item.resource.text) {
        resourceText.push(String(item.resource.text));
      }
      if (uri) {
        resourceText.push(`Resource URI: ${uri}`);
      }
      if (item.resource.name) {
        resourceText.push(`Resource: ${item.resource.name}`);
      }
      if (item.resource.description) {
        resourceText.push(`Description: ${item.resource.description}`);
      }
      if (mime) {
        resourceText.push(`Type: ${mime}`);
      }
      currentTextBlock += (currentTextBlock ? '\n\n' : '') + resourceText.join('\n');
    },
    resource_link: (item: ResourceLink) => {
      if (!item?.uri) {
        return;
      }
      // Render resource links as image_url if they look like images
      if (item.uri.startsWith('http') || item.uri.startsWith('data:image')) {
        imageUrls.push({
          type: 'image_url',
          image_url: { url: item.uri },
        } as t.FormattedContent);
        return;
      }
      const lines: string[] = [];
      if (item.name) {
        lines.push(`Resource: ${item.name}`);
      }
      lines.push(`Resource URI: ${item.uri}`);
      currentTextBlock += (currentTextBlock ? '\n\n' : '') + lines.join('\n');
    },
  };

  for (const item of content as ExtendedToolContentPart[]) {
    const handler = contentHandlers[item.type as keyof typeof contentHandlers] as ContentHandler;
    if (handler) {
      handler(item as unknown as t.ToolContentPart);
    } else {
      const stringified = JSON.stringify(item, null, 2);
      currentTextBlock += (currentTextBlock ? '\n\n' : '') + stringified;
    }
  }

  if (CONTENT_ARRAY_PROVIDERS.has(provider) && currentTextBlock) {
    formattedContent.push({ type: 'text', text: currentTextBlock });
  }

  const artifacts = imageUrls.length ? { content: imageUrls } : undefined;
  if (CONTENT_ARRAY_PROVIDERS.has(provider)) {
    return [formattedContent, artifacts];
  }

  return [currentTextBlock, artifacts];
}
