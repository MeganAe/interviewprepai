public sealed class PaywallMiddleware(RequestDelegate next) {
    // Real routes, segment boundaries (not substrings). Exports/deletion stay available.
    public static bool RequiresPayment(PathString path)=>path.StartsWithSegments("/api/cvs") || path.StartsWithSegments("/api/sessions") || string.Equals(path.Value?.TrimEnd('/'),"/api/data",StringComparison.OrdinalIgnoreCase);
    public async Task InvokeAsync(HttpContext context,Store db,AdminAccess admin) {
        if(RequiresPayment(context.Request.Path) && context.User.Identity?.IsAuthenticated==true) {
            var user=await db.UserByIdAsync(Auth.Id(context),context.RequestAborted);
            if(user is null){context.Response.StatusCode=401;return;}
            if(!user.IsPaid && !admin.IsAdmin(user.Id)) {
                context.Response.StatusCode=402;
                await context.Response.WriteAsJsonAsync(new{code="PAYMENT_REQUIRED",error="Activez votre accès pour analyser un CV ou préparer un entretien."},context.RequestAborted);return;
            }
        }
        await next(context);
    }
}
