// JS-QUIC streams are not byte streams, forcing reads in chunks.
// Since we are doing our BIT banging framing we need a way to read in bytes.

import {
    ReadableByteStreamController,
    ReadableStream,
    ReadableStreamBYOBReader,
    ReadableStreamDefaultReader,
    TransformStream,
    WritableStream,
} from "stream/web";

type StreamConverter = {
    convertToByteStream: (
        reader: ReadableStreamDefaultReader<Uint8Array>,
    ) => ReadableStream<Uint8Array>;
    convertToByteStreamPump: (
        reader: ReadableStreamDefaultReader<Uint8Array>,
    ) => ReadableStream<Uint8Array>;
};

const StreamConverter: StreamConverter = {
    convertToByteStream: (
        reader: ReadableStreamDefaultReader<Uint8Array>,
    ): ReadableStream<Uint8Array> => {
        // Create a proper byte stream that supports BYOB
        return new ReadableStream({
            type: "bytes",
            async pull(controller) {
                try {
                    const { value, done } = await reader.read();
                    if (done) {
                        controller.close();
                        return;
                    }

                    if (value) {
                        const byteController =
                            controller as ReadableByteStreamController;
                        const view = new Uint8Array(value);
                        byteController.enqueue(view);
                    }
                } catch (error) {
                    controller.error(error);
                }
            },
            cancel() {
                reader.releaseLock();
            },
        }, {
            highWaterMark: 0, // Let the original stream control backpressure
        });
    },

    convertToByteStreamPump: (
        reader: ReadableStreamDefaultReader<Uint8Array>,
    ): ReadableStream<Uint8Array> => {
        return new ReadableStream({
            type: "bytes", // Mark as byte stream
            start(controller) {
                const byteController =
                    controller as ReadableByteStreamController;
                async function pump() {
                    try {
                        while (true) {
                            const { value, done } = await reader.read();
                            if (done) {
                                byteController.close();
                                return;
                            }
                            byteController.enqueue(value); // Enqueue to ByteStreamController
                        }
                    } catch (err) {
                        byteController.error(err);
                        reader.releaseLock();
                    }
                }
                pump();
            },
            cancel() {
                reader.releaseLock();
            },
        }, {
            highWaterMark: 0, // Optional: let original stream control backpressure
        });
    },
};
export default StreamConverter;
