using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public class ApiTests : IDisposable {
    readonly TestDatabase database=new();
    readonly WebApplicationFactory<Program> factory;
    public ApiTests(){factory=new WebApplicationFactory<Program>().WithWebHostBuilder(b=>b.UseEnvironment("Development").UseSetting("Supabase:ConnectionString",database.ConnectionString));}
    HttpClient Client(){var c=factory.CreateClient();c.DefaultRequestHeaders.Add("X-Requested-With","InterviewPrep");return c;}
    async Task<HttpClient> Register(){var c=Client();var r=await c.PostAsJsonAsync("/api/auth/register",new { name="Test utilisateur",email=Guid.NewGuid()+"@example.test",password="test-only-password-728" });Assert.Equal(HttpStatusCode.OK,r.StatusCode);var u=await r.Content.ReadFromJsonAsync<JsonObject>();factory.Services.GetRequiredService<Store>().Execute("UPDATE public.users SET is_paid=true,paid_at=CURRENT_TIMESTAMP WHERE id=@id",("id",u!["id"]!.GetValue<string>()));return c;}
    [Fact] public async Task HealthDoesNotPretendGeminiIsConfigured(){using var c=Client();var data=await c.GetFromJsonAsync<JsonObject>("/api/health");Assert.False(data!["geminiConfigured"]!.GetValue<bool>());}
    [Fact] public async Task PrivateDataRequiresAuthentication(){using var c=Client();Assert.Equal(HttpStatusCode.Unauthorized,(await c.GetAsync("/api/data")).StatusCode);}
    [Fact] public async Task MutationsNeedCsrfHeader(){using var c=factory.CreateClient();var r=await c.PostAsJsonAsync("/api/auth/register",new{name="Test",email="test@example.test",password="long-password"});Assert.Equal(HttpStatusCode.Forbidden,r.StatusCode);}
    [Fact] public async Task InvalidRegistrationIsRejected(){using var c=Client();var r=await c.PostAsJsonAsync("/api/auth/register",new{name="T",email="invalid",password="short"});Assert.Equal(HttpStatusCode.BadRequest,r.StatusCode);}
    [Fact] public async Task RegistrationHasAnEmptyWorkspace(){using var c=await Register();var d=await c.GetFromJsonAsync<JsonObject>("/api/data");Assert.Empty(d!["cvs"]!.AsArray());Assert.Empty(d["sessions"]!.AsArray());Assert.Equal(HttpStatusCode.OK,(await c.GetAsync("/api/me")).StatusCode);}
    [Fact] public async Task PasswordsAreVerifiedAndLogoutInvalidatesCookie(){using var c=Client();var email=Guid.NewGuid()+"@example.test";var input=new{name="Test",email,password="a-real-long-test-password"};Assert.Equal(HttpStatusCode.OK,(await c.PostAsJsonAsync("/api/auth/register",input)).StatusCode);await c.PostAsync("/api/auth/logout",null);Assert.Equal(HttpStatusCode.Unauthorized,(await c.GetAsync("/api/me")).StatusCode);Assert.Equal(HttpStatusCode.Unauthorized,(await c.PostAsJsonAsync("/api/auth/login",new{email,password="wrong"})).StatusCode);Assert.Equal(HttpStatusCode.OK,(await c.PostAsJsonAsync("/api/auth/login",input)).StatusCode);}
    [Fact] public async Task NonPdfCannotBeUploaded(){using var c=await Register();using var form=new MultipartFormDataContent();form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("not a pdf")),"file","cv.pdf");form.Add(new StringContent("true"),"consent");Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsync("/api/cvs",form)).StatusCode);}
    [Fact] public async Task ConsentIsRequired(){using var c=await Register();using var form=new MultipartFormDataContent();form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("%PDF-1.7")),"file","cv.pdf");Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsync("/api/cvs",form)).StatusCode);}
    [Fact] public async Task MissingKeyIsReportedWithoutCreatingFakeData(){using var c=await Register();using var form=new MultipartFormDataContent();form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("%PDF-1.7")),"file","cv.pdf");form.Add(new StringContent("true"),"consent");var r=await c.PostAsync("/api/cvs",form);Assert.Equal(HttpStatusCode.ServiceUnavailable,r.StatusCode);Assert.Contains("analyse",await r.Content.ReadAsStringAsync());var data=await c.GetFromJsonAsync<JsonObject>("/api/data");Assert.Empty(data!["cvs"]!.AsArray());}
    [Fact] public async Task AccountsAreIsolated(){using var a=await Register();using var b=await Register();var profile=await a.GetFromJsonAsync<JsonObject>("/api/me");var db=factory.Services.GetRequiredService<Store>();db.Save(profile!["id"]!.GetValue<string>(),"cv",new JsonObject{["id"]="unit-test-cv",["name"]="test-only"});var bdata=await b.GetFromJsonAsync<JsonObject>("/api/data");Assert.Empty(bdata!["cvs"]!.AsArray());await b.DeleteAsync("/api/records/unit-test-cv");var adata=await a.GetFromJsonAsync<JsonObject>("/api/data");Assert.Single(adata!["cvs"]!.AsArray());}
    [Fact] public async Task DeleteAccountDeletesSessionAndData(){using var c=await Register();Assert.Equal(HttpStatusCode.OK,(await c.DeleteAsync("/api/me")).StatusCode);Assert.Equal(HttpStatusCode.Unauthorized,(await c.GetAsync("/api/data")).StatusCode);}
    [Fact] public async Task ProfileCanBeEdited(){using var c=await Register();Assert.Equal(HttpStatusCode.OK,(await c.PutAsJsonAsync("/api/me",new{name="Nouveau nom"})).StatusCode);var u=await c.GetFromJsonAsync<JsonObject>("/api/me");Assert.Equal("Nouveau nom",u!["name"]!.GetValue<string>());}
    class WorkflowHandler : HttpMessageHandler {
        int call;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct){
            string text=call++ switch {
                0 => "{\"isCv\":true,\"role\":\"Poste de test\",\"summary\":\"Données de test uniquement\",\"skills\":[\"Compétence test\"],\"tips\":[\"Conseil test\"]}",
                1 => System.Text.Json.JsonSerializer.Serialize(new {questions=Enumerable.Range(1,5).Select(i=>new{category="Test",text="Question de test "+i,hint="Indice de test"})}),
                _ => System.Text.Json.JsonSerializer.Serialize(new {score=0,summary="Bilan de test",criteria=new[]{new{name="Pertinence",score=60,comment="Test"},new{name="Structure",score=80,comment="Test"},new{name="Précision",score=100,comment="Test"}},strengths=new[]{"Test"},improvements=new[]{"Test"},feedback=Enumerable.Range(1,5).Select(i=>new{comment="Test "+i,example="Test "+i})})
            };
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK){Content=JsonContent.Create(new{candidates=new[]{new{finishReason="STOP",content=new{parts=new[]{new{text}}}}}})});
        }
    }
    [Fact] public async Task FullInterviewWorkflowPersistsAndComputesScore(){
        var handler=new WorkflowHandler();
        var config=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Gemini:ApiKey","unit-test-secret"}}).Build();
        using var testFactory=factory.WithWebHostBuilder(b=>b.ConfigureServices(s=>s.AddTransient<Gemini>(_=>new Gemini(new HttpClient(handler),config))));
        using var c=testFactory.CreateClient();c.DefaultRequestHeaders.Add("X-Requested-With","InterviewPrep");
        Assert.Equal(HttpStatusCode.OK,(await c.PostAsJsonAsync("/api/auth/register",new{name="Test",email="workflow@example.test",password="test-only-password-728"})).StatusCode);
        var me=await c.GetFromJsonAsync<JsonObject>("/api/me");testFactory.Services.GetRequiredService<Store>().Execute("UPDATE public.users SET is_paid=true,paid_at=CURRENT_TIMESTAMP WHERE id=@id",("id",me!["id"]!.GetValue<string>()));
        using var form=new MultipartFormDataContent();form.Add(new ByteArrayContent(Encoding.UTF8.GetBytes("%PDF-1.7")),"file","test-only.pdf");form.Add(new StringContent("true"),"consent");
        var cvResponse=await c.PostAsync("/api/cvs",form);Assert.Equal(HttpStatusCode.OK,cvResponse.StatusCode);var cv=await cvResponse.Content.ReadFromJsonAsync<JsonObject>();
        var start=await c.PostAsJsonAsync("/api/sessions",new{cvId=cv!["id"]!.GetValue<string>(),role="Poste de test",level="Débutant",count=5});Assert.Equal(HttpStatusCode.OK,start.StatusCode);
        var session=await start.Content.ReadFromJsonAsync<JsonObject>();var id=session!["id"]!.GetValue<string>();Assert.Equal(5,session["questions"]!.AsArray().Count);
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsync($"/api/sessions/{id}/evaluate",null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await c.PutAsJsonAsync($"/api/sessions/{id}/answers",new{values=Enumerable.Repeat("Réponse de test suffisamment longue pour être évaluée.",5)})).StatusCode);
        var evaluation=await c.PostAsync($"/api/sessions/{id}/evaluate",null);Assert.Equal(HttpStatusCode.OK,evaluation.StatusCode);var result=await evaluation.Content.ReadFromJsonAsync<JsonObject>();Assert.Equal(80,result!["result"]!["score"]!.GetValue<int>());
        Assert.Equal(HttpStatusCode.Conflict,(await c.PutAsJsonAsync($"/api/sessions/{id}/answers",new{values=Enumerable.Repeat("Modification interdite après la fin.",5)})).StatusCode);
        var saved=await c.GetFromJsonAsync<JsonObject>("/api/data");Assert.Equal(80,saved!["sessions"]![0]!["result"]!["score"]!.GetValue<int>());
    }
    public void Dispose(){factory.Dispose();database.Dispose();}
}
public class GeminiTests {
    class Handler(Func<HttpRequestMessage,Task<HttpResponseMessage>> fn):HttpMessageHandler {protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r,CancellationToken ct)=>fn(r);}
    [Fact] public async Task GeminiSendsKeyInHeaderAndPdfInline(){
        var handler=new Handler(async r=>{
            Assert.Equal("unit-test-secret",r.Headers.GetValues("x-goog-api-key").Single());
            Assert.DoesNotContain("unit-test-secret",r.RequestUri!.ToString());
            Assert.EndsWith("gemini-2.5-flash:generateContent",r.RequestUri.ToString());
            var body=JsonNode.Parse(await r.Content!.ReadAsStringAsync())!;
            Assert.Equal("application/json",body["generationConfig"]!["responseMimeType"]!.GetValue<string>());
            Assert.Equal("application/pdf",body["contents"]![0]!["parts"]![1]!["inlineData"]!["mimeType"]!.GetValue<string>());
            return new HttpResponseMessage(HttpStatusCode.OK){Content=JsonContent.Create(new{candidates=new[]{new{finishReason="STOP",content=new{parts=new[]{new{text="{\"ok\":true}"}}}}}})};
        });
        var config=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Gemini:ApiKey","unit-test-secret"}}).Build();
        var ai=new Gemini(new HttpClient(handler),config);var output=await ai.Call("Test only",Schemas.Cv,Encoding.UTF8.GetBytes("%PDF-test"));Assert.True(output["ok"]!.GetValue<bool>());
    }
    [Fact] public async Task GeminiQuotaFailureHasAnActionableMessage(){
        var handler=new Handler(_=>Task.FromResult(new HttpResponseMessage(HttpStatusCode.TooManyRequests)));
        var config=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Gemini:ApiKey","unit-test-secret"}}).Build();
        var ai=new Gemini(new HttpClient(handler),config);var ex=await Assert.ThrowsAsync<ApiError>(()=>ai.Call("Test only",Schemas.Cv));Assert.Contains("quota",ex.Message);Assert.Equal(502,ex.Status);
    }
    [Fact] public async Task GeminiBlockedResponseIsNotFabricated(){
        var handler=new Handler(_=>Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK){Content=JsonContent.Create(new{candidates=new[]{new{finishReason="SAFETY"}}})}));
        var config=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"Gemini:ApiKey","unit-test-secret"}}).Build();
        var ai=new Gemini(new HttpClient(handler),config);var ex=await Assert.ThrowsAsync<ApiError>(()=>ai.Call("Test only",Schemas.Cv));Assert.Equal(422,ex.Status);
    }
}
