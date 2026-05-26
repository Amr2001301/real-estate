import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatProvider } from './providers/chat-provider';
import { RuleBasedChatProvider } from './providers/rule-based.provider';
import { CatalogSearchTool } from './providers/rule-based/catalog-search';
import { CatalogSearchService } from './providers/rule-based/catalog-search.service';
import { ConversionTool } from './providers/rule-based/conversion';
import { ConversionService } from './providers/rule-based/conversion.service';
import { UnitsModule } from '../units/units.module';
import { ProjectsModule } from '../projects/projects.module';
import { RequestsModule } from '../requests/requests.module';

/**
 * AI Chat module (v1). Public, non-streaming, FREE rule-based assistant — no
 * external AI calls, no keys, no LLM. The provider is bound via the ChatProvider
 * token and runs the PUBLIC catalog search through CatalogSearchTool (backed by
 * the existing UnitsService/ProjectsService). MockChatProvider remains for unit
 * tests (injected directly there).
 */
@Module({
  imports: [UnitsModule, ProjectsModule, RequestsModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    { provide: ChatProvider, useClass: RuleBasedChatProvider },
    { provide: CatalogSearchTool, useClass: CatalogSearchService },
    { provide: ConversionTool, useClass: ConversionService },
  ],
})
export class ChatModule {}
