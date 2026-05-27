import '../../domain/entities/chat_entities.dart';
import '../dtos/chat_dtos.dart';

/// Maps chat DTOs → domain entities.
extension ChatMessageDtoMapper on ChatMessageDto {
  ChatMessage toEntity() => ChatMessage(
        id: id,
        role: role == 'USER' ? ChatRole.user : ChatRole.assistant,
        content: content,
      );
}

extension ChatCardDtoMapper on ChatCardDto {
  ChatCard toEntity() => ChatCard(
        type: type,
        id: id,
        title: title,
        subtitle: subtitle,
        price: price,
        imageUrl: imageUrl,
        href: href,
      );
}

extension ChatCtaDtoMapper on ChatCtaDto {
  ChatCta toEntity() => ChatCta(
        kind: kind,
        label: label,
        href: href,
        action: action,
        payloadMessage: payloadMessage,
      );
}

extension AssistantOutputDtoMapper on AssistantOutputDto {
  AssistantOutput toEntity() => AssistantOutput(
        message: message.toEntity(),
        cards: cards.map((c) => c.toEntity()).toList(),
        ctas: ctas.map((c) => c.toEntity()).toList(),
        quickReplies: quickReplies,
        missingFields: missingFields,
      );
}

extension ChatSessionStartDtoMapper on ChatSessionStartDto {
  ChatSessionStart toEntity() => ChatSessionStart(
        sessionId: sessionId,
        greeting: greeting,
        quickReplies: quickReplies,
      );
}

extension RestoredSessionDtoMapper on RestoredSessionDto {
  RestoredSession toEntity() => RestoredSession(
        sessionId: sessionId,
        messages: messages.map((m) => m.toEntity()).toList(),
      );
}
