import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Chat } from './chat.entity';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

// key/contentType/filename are what's actually persisted (see the
// `attachments` column below) — never a URL, since the bucket is private
// and a stored one would just be a presigned url that quietly expires.
// `url` is never stored: ChatsService.resolveMessageAttachments fills it in
// fresh on every read (see there for why), so it's only present on a
// message once it's come back out of ChatsService, not on one being built
// for a new save.
export interface MessageAttachment {
  key: string;
  contentType: string;
  filename: string;
  url?: string;
}

// A snapshot of a saved Item attached to a message (see ChatsService's
// resolveAttachedItem) — not a live reference, so the message keeps showing
// what was actually attached even if the item's since been edited or
// deleted. Distinct from isItemCard/itemTitle/itemToolSlug below: those are
// for a message that IS an item card on its own (createChatFromItem's
// seeded message, with no user text); this is for an ordinary user message
// that happens to have one attached alongside its own typed content — same
// idea as `attachments` for an image, just for a saved item instead.
export interface AttachedItem {
  itemId: string;
  toolSlug: string;
  title: string;
  data: unknown;
}

@Entity('chat_messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Chat, (chat) => chat.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat: Chat;

  @Column({ name: 'chat_id' })
  chatId: string;

  @Column({ type: 'enum', enum: MessageRole })
  role: MessageRole;

  @Column({ type: 'text' })
  content: string;

  // True only for the item-card message ChatsService.createChatFromItem
  // seeds a chat with — renders as the compact item card (no thumbs/copy,
  // no full definition) instead of going through the tool's normal
  // ResponseView like every other message.
  @Column({ name: 'is_item_card', type: 'boolean', default: false })
  isItemCard: boolean;

  // The saved item's own title (Item.title) at the time this item-card
  // message was created — content only holds the item's raw `data`, which
  // has no single field name for "the display title" that's consistent
  // across every tool's shape (word-helper's `word`, quote-finder's `text`,
  // ...), so it has to be captured here rather than derived from content on
  // read. Null for any non-item-card message, and for an item-card message
  // saved before this column existed (the frontend falls back to the
  // chat's tool name for those, same as it did before this existed).
  @Column({ name: 'item_title', type: 'varchar', nullable: true })
  itemTitle: string | null;

  // The item's own tool (Item.toolSlug), which — since "open in another
  // tool" (see ChatsService.createChatFromItem) — is not necessarily the
  // same as this message's own chat.toolSlug. The frontend needs this to
  // pick the *item's* ItemView (e.g. a film item still renders with its
  // title+year card even sitting inside a Story Explainer chat) rather
  // than the current tool's, which may not know how to display it at all.
  // Null for any non-item-card message, and for an item-card message saved
  // before this column existed (the frontend falls back to the chat's own
  // tool for those, same as it did before this existed).
  @Column({ name: 'item_tool_slug', type: 'varchar', nullable: true })
  itemToolSlug: string | null;

  // Image attachments on a user message (see UploadsController) — always
  // null on an assistant reply. Null, not an empty array, on any message
  // with no attachments (including every one saved before this existed).
  @Column({ type: 'jsonb', nullable: true })
  attachments: MessageAttachment[] | null;

  // Saved item(s) attached to this message (see AttachedItem above) —
  // always null on an assistant reply, and on any message with nothing
  // attached. Null, not an empty array, when there's nothing attached
  // (same convention as `attachments` above).
  @Column({ name: 'attached_items', type: 'jsonb', nullable: true })
  attachedItems: AttachedItem[] | null;

  // A real walking route computed for this specific Steps Planner reply
  // (see StepsPlannerService.planRoute/GoogleMapsClient) — set directly
  // from Google's Routes API response, never authored or estimated by the
  // model, so the distance/duration/path the user sees and saves is always
  // the real computed route. Only ever set on an ASSISTANT message; null
  // (not on any other tool, and null on a Steps Planner reply that
  // couldn't find a route at all — e.g. a clarifying question, or a
  // real API failure).
  @Column({ name: 'route_distance_meters', type: 'integer', nullable: true })
  routeDistanceMeters: number | null;

  @Column({ name: 'route_duration_seconds', type: 'integer', nullable: true })
  routeDurationSeconds: number | null;

  // Google's polyline-algorithm-encoded path — decoded client-side via the
  // Maps JavaScript API's geometry library (see steps-planner/ResponseView.tsx)
  // to draw the real route on a map. Opaque to this app; never parsed here.
  @Column({ name: 'route_encoded_polyline', type: 'text', nullable: true })
  routeEncodedPolyline: string | null;

  @Column({ name: 'route_start_label', type: 'varchar', nullable: true })
  routeStartLabel: string | null;

  @Column({ name: 'route_destination_label', type: 'varchar', nullable: true })
  routeDestinationLabel: string | null;

  // Shared by every message in the same "tweak this route" conversation
  // thread (see StepsPlannerService.planRoute's continuation handling) —
  // lets the frontend update one saved Item across a whole back-and-forth
  // instead of creating a new one per message. Null for a non-continuation
  // route (its own thread, keyed by its own message id) or a non-route
  // reply.
  @Column({ name: 'route_thread_id', type: 'varchar', nullable: true })
  routeThreadId: string | null;

  // A real product SerpApi's Google Shopping search found for this
  // specific Shopping-tool reply (see ShoppingService.findProduct) — set
  // directly from that real result, never authored or estimated by the
  // model. Only ever set on an ASSISTANT message; null on any reply that
  // couldn't find a product (a clarifying question, or a real API
  // failure).
  @Column({ name: 'product_title', type: 'varchar', nullable: true })
  productTitle: string | null;

  @Column({ name: 'product_price', type: 'varchar', nullable: true })
  productPrice: string | null;

  @Column({ name: 'product_old_price', type: 'varchar', nullable: true })
  productOldPrice: string | null;

  @Column({ name: 'product_thumbnail', type: 'text', nullable: true })
  productThumbnail: string | null;

  @Column({ name: 'product_link', type: 'text', nullable: true })
  productLink: string | null;

  @Column({ name: 'product_source', type: 'varchar', nullable: true })
  productSource: string | null;

  @Column({ name: 'product_rating', type: 'real', nullable: true })
  productRating: number | null;

  @Column({ name: 'product_reviews', type: 'integer', nullable: true })
  productReviews: number | null;

  // Shared by every message in the same "tweak this product" conversation
  // thread (see ShoppingService.findProduct's continuation handling, and
  // routeThreadId's identical pattern above) — lets the frontend update
  // one saved Item across a whole back-and-forth ("change it to red")
  // instead of creating a new one per message.
  @Column({ name: 'product_thread_id', type: 'varchar', nullable: true })
  productThreadId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
