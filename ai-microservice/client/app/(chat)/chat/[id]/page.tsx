import { Chat } from '@/components/chat/chat';

type chatPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ChatPage({ params }: chatPageProps) {
  const id = (await params).id;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Chat id={id} />
    </div>
  );
}
