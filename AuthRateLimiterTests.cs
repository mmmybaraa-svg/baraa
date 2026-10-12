using Darb.Api;
using Xunit;

namespace Darb.Api.Tests;

public sealed class AuthRateLimiterTests
{
    [Fact]
    public void IsLimited_AllowsUpToTheMaximumThenBlocks()
    {
        var limiter = new AuthRateLimiter();
        var now = new DateTime(2026, 10, 12, 9, 0, 0, DateTimeKind.Utc);

        Assert.False(limiter.IsLimited("register:test", TimeSpan.FromMinutes(5), 3, now));
        Assert.False(limiter.IsLimited("register:test", TimeSpan.FromMinutes(5), 3, now.AddSeconds(1)));
        Assert.False(limiter.IsLimited("register:test", TimeSpan.FromMinutes(5), 3, now.AddSeconds(2)));
        Assert.True(limiter.IsLimited("register:test", TimeSpan.FromMinutes(5), 3, now.AddSeconds(3)));
    }

    [Fact]
    public void IsLimited_AllowsAgainAfterTheWindowExpires()
    {
        var limiter = new AuthRateLimiter();
        var now = new DateTime(2026, 10, 12, 9, 0, 0, DateTimeKind.Utc);
        var window = TimeSpan.FromMinutes(5);

        Assert.False(limiter.IsLimited("recovery:test", window, 2, now));
        Assert.False(limiter.IsLimited("recovery:test", window, 2, now.AddMinutes(1)));
        Assert.True(limiter.IsLimited("recovery:test", window, 2, now.AddMinutes(2)));

        Assert.False(limiter.IsLimited("recovery:test", window, 2, now.AddMinutes(10)));
    }

    [Fact]
    public void IsLimited_TracksEachBucketIndependently()
    {
        var limiter = new AuthRateLimiter();
        var now = new DateTime(2026, 10, 12, 9, 0, 0, DateTimeKind.Utc);

        Assert.False(limiter.IsLimited("resend:a@example.com", TimeSpan.FromMinutes(5), 1, now));
        Assert.True(limiter.IsLimited("resend:a@example.com", TimeSpan.FromMinutes(5), 1, now));
        Assert.False(limiter.IsLimited("resend:b@example.com", TimeSpan.FromMinutes(5), 1, now));
    }

    [Theory]
    [InlineData("", 1)]
    [InlineData("bucket", 0)]
    public void IsLimited_RejectsInvalidInputs(string bucket, int maxRequests)
    {
        var limiter = new AuthRateLimiter();
        Assert.ThrowsAny<ArgumentException>(() =>
            limiter.IsLimited(bucket, TimeSpan.FromMinutes(1), maxRequests, DateTime.UtcNow));
    }
}
