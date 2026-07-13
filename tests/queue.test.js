const { enqueueClick, getClientIp } = require("../src/services/queue");
const geoip = require("geoip-lite");

jest.mock("geoip-lite");
jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
  })),
}));

describe("enqueueClick GeoIP Fallback", () => {
  let mockQueue;
  let mockReq;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueue = { add: jest.fn() };
    mockReq = {
      headers: {
        "user-agent": "Mozilla/5.0",
        "referer": "https://google.com",
      },
      connection: {
        remoteAddress: "8.8.8.8",
      },
      socket: {
        remoteAddress: "8.8.8.8",
      },
    };
    process.env.GEOIP_HEADER_NAME = "";
  });

  it("should fallback to geoip-lite when no header is present", async () => {
    geoip.lookup.mockReturnValue({ country: "US" });

    await enqueueClick(mockQueue, "test-slug", mockReq);

    expect(geoip.lookup).toHaveBeenCalledWith("8.8.8.8");
    expect(mockQueue.add).toHaveBeenCalledWith(
      "click",
      expect.objectContaining({ country: "US" }),
      expect.any(Object)
    );
  });

  it("should use sentinel 'unknown' when both header and geoip-lite fail", async () => {
    geoip.lookup.mockReturnValue(null);

    await enqueueClick(mockQueue, "test-slug", mockReq);

    expect(mockQueue.add).toHaveBeenCalledWith(
      "click",
      expect.objectContaining({ country: "unknown" }),
      expect.any(Object)
    );
  });

  it("should prioritize GEOIP_HEADER_NAME if provided and present in request", async () => {
    process.env.GEOIP_HEADER_NAME = "x-custom-geo";
    mockReq.headers["x-custom-geo"] = "FR";
    geoip.lookup.mockReturnValue({ country: "US" });

    await enqueueClick(mockQueue, "test-slug", mockReq);

    expect(mockQueue.add).toHaveBeenCalledWith(
      "click",
      expect.objectContaining({ country: "FR" }),
      expect.any(Object)
    );
    expect(geoip.lookup).not.toHaveBeenCalled();
  });

  it("should fallback to geoip-lite if GEOIP_HEADER_NAME is provided but missing in request", async () => {
    process.env.GEOIP_HEADER_NAME = "x-custom-geo";
    // mockReq.headers["x-custom-geo"] is missing
    geoip.lookup.mockReturnValue({ country: "DE" });

    await enqueueClick(mockQueue, "test-slug", mockReq);

    expect(mockQueue.add).toHaveBeenCalledWith(
      "click",
      expect.objectContaining({ country: "DE" }),
      expect.any(Object)
    );
  });
});
