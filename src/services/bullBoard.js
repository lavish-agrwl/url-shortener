const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");

function createQueueBoard({ clickQueue, clickDlq }) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: [
      new BullMQAdapter(clickQueue),
      new BullMQAdapter(clickDlq),
    ],
    serverAdapter,
  });

  return serverAdapter.getRouter();
}

module.exports = {
  createQueueBoard,
};
