using System.Text.Json.Nodes;
using Xunit;

public class ShippingFlagTests {
    [Theory]
    [InlineData("null",false)]
    [InlineData("false",false)]
    [InlineData("true",true)]
    [InlineData("0",false)]
    [InlineData("0.0",false)]
    [InlineData("1",true)]
    [InlineData("1.0",true)]
    [InlineData("\"false\"",false)]
    [InlineData("\" FALSE \"",false)]
    [InlineData("\"true\"",true)]
    [InlineData("\" TRUE \"",true)]
    [InlineData("\"0\"",false)]
    [InlineData("\"1\"",true)]
    [InlineData("\"\"",false)]
    public void RecognizesExplicitRepresentations(string json,bool expected) {
        var settings=new JsonObject{["is_requires_shipping_address"]=JsonNode.Parse(json)};
        Assert.Equal(expected,ChariowClient.RequiresShipping(settings));
    }
    [Theory]
    [InlineData("-1")][InlineData("2")][InlineData("0.5")]
    [InlineData("\"yes\"")][InlineData("\"not-a-boolean\"")]
    [InlineData("[]")][InlineData("{}")]
    public void RejectsUnknownFlagRatherThanSilentlyTreatingItAsFalse(string json) {
        var settings=new JsonObject{["is_requires_shipping_address"]=JsonNode.Parse(json)};
        var error=Assert.Throws<ApiError>(()=>ChariowClient.RequiresShipping(settings));
        Assert.Equal(502,error.Status);
    }
    [Theory][InlineData("[]")][InlineData("\"invalid\"")][InlineData("false")]
    public void RejectsMalformedSettingsObject(string json) {
        Assert.Equal(502,Assert.Throws<ApiError>(()=>ChariowClient.RequiresShipping(JsonNode.Parse(json))).Status);
    }
    [Fact] public void OptionalSettingsDoNotDeclareAShippingRequirement() {
        Assert.False(ChariowClient.RequiresShipping(null));
        Assert.False(ChariowClient.RequiresShipping(new JsonObject()));
    }
}
