import { ChatForm } from './chat-form';

export function Chat({ id }: { id: string }) {
  return (
    <>
      <div className="mx-auto flex h-[calc(100dvh-80px)] max-w-3xl flex-col items-center justify-center">
        <div>
          <p>
            <b> Chat #: {id}</b> - Lorem ipsum dolor sit, amet consectetur adipisicing elit.
            Asperiores laborum, molestiae placeat hic qui esse quibusdam fugiat corporis libero amet
            tempore, quasi ut quod at optio. Reprehenderit tempore eligendi, similique iusto
            reiciendis atque voluptatibus doloremque incidunt veniam quidem perferendis commodi,
            perspiciatis odio, totam aut provident quas dolorum amet adipisci cum. Odio odit dicta
            temporibus non eveniet deserunt, earum harum quidem pariatur vitae laudantium corrupti
            natus id! Esse expedita modi iure nihil illum sint ut accusantium, eveniet quos
            quibusdam alias nisi, omnis quasi, ex maiores. Consectetur corrupti iste ratione nihil,
            temporibus explicabo sapiente deserunt placeat, praesentium et dolore veniam totam ut?
          </p>
        </div>

        <ChatForm />
      </div>
    </>
  );
}
