// =============================
// Email: info@ebenmonney.com
// www.ebenmonney.com/templates
// =============================
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { Utilities, DBkeys } from '@polpware/ngx-appkit-contracts-alpha';
import { JwtHelper } from './jwt-helper';
import { User } from '../models/user.model';
import * as i0 from "@angular/core";
import * as i1 from "@angular/router";
import * as i2 from "./oidc-helper.service";
import * as i3 from "@polpware/ngx-appkit-contracts-alpha";
export class AuthService {
    constructor(router, oidcHelperService, configurationServiceProvider, localStoreManagerProvider) {
        this.router = router;
        this.oidcHelperService = oidcHelperService;
        this._loginStatus = new Subject();
        this.localStorage = localStoreManagerProvider.get();
        this.configurations = configurationServiceProvider.get();
        this.initializeLoginStatus();
    }
    get loginUrl() { return this.configurations.loginUrl; }
    get homeUrl() { return this.configurations.homeUrl; }
    initializeLoginStatus() {
        this.localStorage.getInitEvent().subscribe(() => {
            this.emitLoginStatus();
        });
    }
    gotoPage(page, preserveParams = true) {
        const navigationExtras = {
            queryParamsHandling: preserveParams ? 'merge' : '', preserveFragment: preserveParams
        };
        this.router.navigate([page], navigationExtras);
    }
    gotoHomePage() {
        this.router.navigate([this.homeUrl]);
    }
    redirectLoginUser() {
        const redirect = (this.loginRedirectUrl &&
            (this.loginRedirectUrl != '/') &&
            (this.loginRedirectUrl != this.loginUrl)) ? this.loginRedirectUrl : this.homeUrl;
        this.loginRedirectUrl = null;
        const urlParamsAndFragment = Utilities.splitInTwo(redirect, '#');
        const urlAndParams = Utilities.splitInTwo(urlParamsAndFragment.firstPart, '?');
        const navigationExtras = {
            fragment: urlParamsAndFragment.secondPart,
            queryParams: Utilities.getQueryParamsFromString(urlAndParams.secondPart),
            queryParamsHandling: 'merge'
        };
        this.router.navigate([urlAndParams.firstPart], navigationExtras);
    }
    redirectLogoutUser() {
        const redirect = this.logoutRedirectUrl ? this.logoutRedirectUrl : this.loginUrl;
        this.logoutRedirectUrl = null;
        this.router.navigate([redirect]);
    }
    redirectForLogin(redirectUrl) {
        if (redirectUrl) {
            this.loginRedirectUrl = redirectUrl;
        }
        else {
            this.loginRedirectUrl = this.router.url;
        }
        this.router.navigate([this.loginUrl]);
    }
    reLogin() {
        if (this.reLoginDelegate) {
            this.reLoginDelegate();
        }
        else {
            this.redirectForLogin();
        }
    }
    // Will not change the status that we have 
    refreshLogin() {
        return this.oidcHelperService.refreshLogin()
            .pipe(map(resp => this.processLoginResponse(resp, this.rememberMe, true)));
    }
    loginWithPassword(userName, password, rememberMe) {
        // Clean what we have before, without emitting any event. 
        this.logout(true);
        return this.oidcHelperService.loginWithPassword(userName, password)
            .pipe(map(resp => this.processLoginResponse(resp, rememberMe)));
    }
    // Silent event in case.
    processLoginResponse(response, rememberMe, silentEvent) {
        const accessToken = response.access_token;
        if (accessToken == null) {
            throw new Error('accessToken cannot be null');
        }
        rememberMe = rememberMe || this.rememberMe;
        const refreshToken = response.refresh_token || this.refreshToken;
        const expiresIn = response.expires_in;
        const tokenExpiryDate = new Date();
        tokenExpiryDate.setSeconds(tokenExpiryDate.getSeconds() + expiresIn);
        const accessTokenExpiry = tokenExpiryDate;
        const jwtHelper = new JwtHelper();
        const decodedAccessToken = jwtHelper.decodeToken(accessToken);
        const permissions = Array.isArray(decodedAccessToken.permission) ? decodedAccessToken.permission : [decodedAccessToken.permission];
        if (!this.isLoggedIn) {
            this.configurations.import(decodedAccessToken.configuration);
        }
        const user = new User(decodedAccessToken.sub, decodedAccessToken.name, decodedAccessToken.fullname, decodedAccessToken.email, decodedAccessToken.jobtitle, decodedAccessToken.phone_number, Array.isArray(decodedAccessToken.role) ? decodedAccessToken.role : [decodedAccessToken.role]);
        user.isEnabled = true;
        this.saveUserDetails(user, permissions, accessToken, refreshToken, accessTokenExpiry, rememberMe);
        if (silentEvent !== true) {
            this.emitLoginStatus(user);
        }
        return user;
    }
    saveUserDetails(user, permissions, accessToken, refreshToken, expiresIn, rememberMe) {
        if (rememberMe) {
            this.localStorage.savePermanentData(accessToken, DBkeys.ACCESS_TOKEN);
            this.localStorage.savePermanentData(refreshToken, DBkeys.REFRESH_TOKEN);
            this.localStorage.savePermanentData(expiresIn, DBkeys.TOKEN_EXPIRES_IN);
            this.localStorage.savePermanentData(permissions, DBkeys.USER_PERMISSIONS);
            this.localStorage.savePermanentData(user, DBkeys.CURRENT_USER);
        }
        else {
            this.localStorage.saveSyncedSessionData(accessToken, DBkeys.ACCESS_TOKEN);
            this.localStorage.saveSyncedSessionData(refreshToken, DBkeys.REFRESH_TOKEN);
            this.localStorage.saveSyncedSessionData(expiresIn, DBkeys.TOKEN_EXPIRES_IN);
            this.localStorage.saveSyncedSessionData(permissions, DBkeys.USER_PERMISSIONS);
            this.localStorage.saveSyncedSessionData(user, DBkeys.CURRENT_USER);
        }
        this.localStorage.savePermanentData(rememberMe, DBkeys.REMEMBER_ME);
    }
    // Silient event in case.
    logout(silentEvent) {
        this.localStorage.deleteData(DBkeys.ACCESS_TOKEN);
        this.localStorage.deleteData(DBkeys.REFRESH_TOKEN);
        this.localStorage.deleteData(DBkeys.TOKEN_EXPIRES_IN);
        this.localStorage.deleteData(DBkeys.USER_PERMISSIONS);
        this.localStorage.deleteData(DBkeys.CURRENT_USER);
        this.configurations.clearLocalChanges();
        if (silentEvent !== true) {
            this.emitLoginStatus();
        }
    }
    emitLoginStatus(currentUser) {
        const user = currentUser || this.localStorage.getDataObject(DBkeys.CURRENT_USER, false);
        const isLoggedIn = user != null;
        this._loginStatus.next(isLoggedIn);
    }
    getLoginStatusEvent() {
        return this._loginStatus.asObservable();
    }
    get currentUser() {
        const user = this.localStorage.getDataObject(DBkeys.CURRENT_USER, false);
        return user;
    }
    get userPermissions() {
        return this.localStorage.getDataObject(DBkeys.USER_PERMISSIONS, false) || [];
    }
    get accessToken() {
        return this.oidcHelperService.accessToken;
    }
    get accessTokenExpiryDate() {
        return this.oidcHelperService.accessTokenExpiryDate;
    }
    get refreshToken() {
        return this.oidcHelperService.refreshToken;
    }
    get isSessionExpired() {
        return this.oidcHelperService.isSessionExpired;
    }
    get isLoggedIn() {
        return this.currentUser != null;
    }
    get rememberMe() {
        return this.localStorage.getDataObject(DBkeys.REMEMBER_ME, false) == true;
    }
}
/** @nocollapse */ AuthService.ɵfac = function AuthService_Factory(t) { return new (t || AuthService)(i0.ɵɵinject(i1.Router), i0.ɵɵinject(i2.OidcHelperService), i0.ɵɵinject(i3.ConfigurationServiceAbstractProvider), i0.ɵɵinject(i3.LocalStoreManagerServiceAbstractProvider)); };
/** @nocollapse */ AuthService.ɵprov = i0.ɵɵdefineInjectable({ token: AuthService, factory: AuthService.ɵfac });
/*@__PURE__*/ (function () { i0.ɵsetClassMetadata(AuthService, [{
        type: Injectable
    }], function () { return [{ type: i1.Router }, { type: i2.OidcHelperService }, { type: i3.ConfigurationServiceAbstractProvider }, { type: i3.LocalStoreManagerServiceAbstractProvider }]; }, null); })();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6Im5nOi8vQHBvbHB3YXJlL25neC1vYXV0aDIvIiwic291cmNlcyI6WyJsaWIvc2VydmljZXMvYXV0aC5zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGdDQUFnQztBQUNoQyw2QkFBNkI7QUFDN0IsK0JBQStCO0FBQy9CLGdDQUFnQztBQUVoQyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRTNDLE9BQU8sRUFBYyxPQUFPLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDM0MsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBRXJDLE9BQU8sRUFLSCxTQUFTLEVBQ1QsTUFBTSxFQUVULE1BQU0sc0NBQXNDLENBQUM7QUFHOUMsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUV6QyxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7Ozs7O0FBSTVDLE1BQU0sT0FBTyxXQUFXO0lBY3BCLFlBQ1ksTUFBYyxFQUNkLGlCQUFvQyxFQUM1Qyw0QkFBa0UsRUFDbEUseUJBQW1FO1FBSDNELFdBQU0sR0FBTixNQUFNLENBQVE7UUFDZCxzQkFBaUIsR0FBakIsaUJBQWlCLENBQW1CO1FBUHhDLGlCQUFZLEdBQUcsSUFBSSxPQUFPLEVBQVcsQ0FBQztRQVcxQyxJQUFJLENBQUMsWUFBWSxHQUFHLHlCQUF5QixDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ3BELElBQUksQ0FBQyxjQUFjLEdBQUcsNEJBQTRCLENBQUMsR0FBRyxFQUFFLENBQUM7UUFFekQsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7SUFDakMsQ0FBQztJQXZCRCxJQUFXLFFBQVEsS0FBSyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUM5RCxJQUFXLE9BQU8sS0FBSyxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxD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QUFDLFlBQVksQ0FBQyxhQUFhLENBQXFCLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDckcsQ0FBQztJQUVELElBQUksV0FBVztRQUNYLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQztJQUM5QyxDQUFDO0lBRUQsSUFBSSxxQkFBcUI7UUFDckIsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMscUJBQXFCLENBQUM7SUFDeEQsQ0FBQztJQUVELElBQUksWUFBWTtRQUNaLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQztJQUMvQyxDQUFDO0lBRUQsSUFBSSxnQkFBZ0I7UUFDaEIsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsZ0JBQWdCLENBQUM7SUFDbkQsQ0FBQztJQUVELElBQUksVUFBVTtRQUNWLE9BQU8sSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksVUFBVTtRQUNWLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQVUsTUFBTSxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUM7SUFDdkYsQ0FBQzs7eUZBM05RLFdBQVc7c0VBQVgsV0FBVyxXQUFYLFdBQVc7a0RBQVgsV0FBVztjQUR2QixVQUFVIiwic291cmNlc0NvbnRlbnQiOlsiLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEVtYWlsOiBpbmZvQGViZW5tb25uZXkuY29tXG4vLyB3d3cuZWJlbm1vbm5leS5jb20vdGVtcGxhdGVzXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5pbXBvcnQgeyBJbmplY3RhYmxlIH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBSb3V0ZXIsIE5hdmlnYXRpb25FeHRyYXMgfSBmcm9tICdAYW5ndWxhci9yb3V0ZXInO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgU3ViamVjdCB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgbWFwIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuXG5pbXBvcnQge1xuICAgIElMb2NhbFN0b3JlTWFuYWdlckNvbnRyYWN0LFxuICAgIExvY2FsU3RvcmVNYW5hZ2VyU2VydmljZUFic3RyYWN0UHJvdmlkZXIsXG4gICAgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlQ29udHJhY3QsXG4gICAgQ29uZmlndXJhdGlvblNlcnZpY2VBYnN0cmFjdFByb3ZpZGVyLFxuICAgIFV0aWxpdGllcyxcbiAgICBEQmtleXMsXG4gICAgQ29uZmlndXJhdGlvblNlcnZpY2VDb25zdGFudHNcbn0gZnJvbSAnQHBvbHB3YXJlL25neC1hcHBraXQtY29udHJhY3RzLWFscGhhJztcblxuaW1wb3J0IHsgT2lkY0hlbHBlclNlcnZpY2UgfSBmcm9tICcuL29pZGMtaGVscGVyLnNlcnZpY2UnO1xuaW1wb3J0IHsgSnd0SGVscGVyIH0gZnJvbSAnLi9qd3QtaGVscGVyJztcbmltcG9ydCB7IEFjY2Vzc1Rva2VuLCBMb2dpblJlc3BvbnNlIH0gZnJvbSAnLi4vbW9kZWxzL2xvZ2luLXJlc3BvbnNlLm1vZGVsJztcbmltcG9ydCB7IFVzZXIgfSBmcm9tICcuLi9tb2RlbHMvdXNlci5tb2RlbCc7XG5pbXBvcnQgeyBQZXJtaXNzaW9uVmFsdWVzIH0gZnJvbSAnLi4vbW9kZWxzL3Blcm1pc3Npb24ubW9kZWwnO1xuXG5ASW5qZWN0YWJsZSgpXG5leHBvcnQgY2xhc3MgQXV0aFNlcnZpY2Uge1xuICAgIHB1YmxpYyBnZXQgbG9naW5VcmwoKSB7IHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25zLmxvZ2luVXJsOyB9XG4gICAgcHVibGljIGdldCBob21lVXJsKCkgeyByZXR1cm4gdGhpcy5jb25maWd1cmF0aW9ucy5ob21lVXJsOyB9XG5cbiAgICBwdWJsaWMgbG9naW5SZWRpcmVjdFVybDogc3RyaW5nO1xuICAgIHB1YmxpYyBsb2dvdXRSZWRpcmVjdFVybDogc3RyaW5nO1xuXG4gICAgcHVibGljIHJlTG9naW5EZWxlZ2F0ZTogKCkgPT4gdm9pZDtcblxuICAgIHByaXZhdGUgX2xvZ2luU3RhdHVzID0gbmV3IFN1YmplY3Q8Ym9vbGVhbj4oKTtcblxuICAgIHByaXZhdGUgbG9jYWxTdG9yYWdlOiBJTG9jYWxTdG9yZU1hbmFnZXJDb250cmFjdDtcbiAgICBwcml2YXRlIGNvbmZpZ3VyYXRpb25zOiBJQ29uZmlndXJhdGlvblNlcnZpY2VDb250cmFjdDtcblxuICAgIGNvbnN0cnVjdG9yKFxuICAgICAgICBwcml2YXRlIHJvdXRlcjogUm91dGVyLFxuICAgICAgICBwcml2YXRlIG9pZGNIZWxwZXJTZXJ2aWNlOiBPaWRjSGVscGVyU2VydmljZSxcbiAgICAgICAgY29uZmlndXJhdGlvblNlcnZpY2VQcm92aWRlcjogQ29uZmlndXJhdGlvblNlcnZpY2VBYnN0cmFjdFByb3ZpZGVyLFxuICAgICAgICBsb2NhbFN0b3JlTWFuYWdlclByb3ZpZGVyOiBMb2NhbFN0b3JlTWFuYWdlclNlcnZpY2VBYnN0cmFjdFByb3ZpZGVyKSB7XG5cbiAgICAgICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JlTWFuYWdlclByb3ZpZGVyLmdldCgpO1xuICAgICAgICB0aGlzLmNvbmZpZ3VyYXRpb25zID0gY29uZmlndXJhdGlvblNlcnZpY2VQcm92aWRlci5nZXQoKTtcblxuICAgICAgICB0aGlzLmluaXRpYWxpemVMb2dpblN0YXR1cygpO1xuICAgIH1cblxuICAgIHByaXZhdGUgaW5pdGlhbGl6ZUxvZ2luU3RhdHVzKCkge1xuICAgICAgICB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJbml0RXZlbnQoKS5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5lbWl0TG9naW5TdGF0dXMoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ290b1BhZ2UocGFnZTogc3RyaW5nLCBwcmVzZXJ2ZVBhcmFtcyA9IHRydWUpIHtcblxuICAgICAgICBjb25zdCBuYXZpZ2F0aW9uRXh0cmFzOiBOYXZpZ2F0aW9uRXh0cmFzID0ge1xuICAgICAgICAgICAgcXVlcnlQYXJhbXNIYW5kbGluZzogcHJlc2VydmVQYXJhbXMgPyAnbWVyZ2UnIDogJycsIHByZXNlcnZlRnJhZ21lbnQ6IHByZXNlcnZlUGFyYW1zXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5yb3V0ZXIubmF2aWdhdGUoW3BhZ2VdLCBuYXZpZ2F0aW9uRXh0cmFzKTtcbiAgICB9XG5cbiAgICBnb3RvSG9tZVBhZ2UoKSB7XG4gICAgICAgIHRoaXMucm91dGVyLm5hdmlnYXRlKFt0aGlzLmhvbWVVcmxdKTtcbiAgICB9XG5cbiAgICByZWRpcmVjdExvZ2luVXNlcigpIHtcblxuICAgICAgICBjb25zdCByZWRpcmVjdCA9ICh0aGlzLmxvZ2luUmVkaXJlY3RVcmwgJiZcbiAgICAgICAgICAgICh0aGlzLmxvZ2luUmVkaXJlY3RVcmwgIT0gJy8nKSAmJlxuICAgICAgICAgICAgKHRoaXMubG9naW5SZWRpcmVjdFVybCAhPSB0aGlzLmxvZ2luVXJsKSkgPyB0aGlzLmxvZ2luUmVkaXJlY3RVcmwgOiB0aGlzLmhvbWVVcmw7XG4gICAgICAgIHRoaXMubG9naW5SZWRpcmVjdFVybCA9IG51bGw7XG5cbiAgICAgICAgY29uc3QgdXJsUGFyYW1zQW5kRnJhZ21lbnQgPSBVdGlsaXRpZXMuc3BsaXRJblR3byhyZWRpcmVjdCwgJyMnKTtcbiAgICAgICAgY29uc3QgdXJsQW5kUGFyYW1zID0gVXRpbGl0aWVzLnNwbGl0SW5Ud28odXJsUGFyYW1zQW5kRnJhZ21lbnQuZmlyc3RQYXJ0LCAnPycpO1xuXG4gICAgICAgIGNvbnN0IG5hdmlnYXRpb25FeHRyYXM6IE5hdmlnYXRpb25FeHRyYXMgPSB7XG4gICAgICAgICAgICBmcmFnbWVudDogdXJsUGFyYW1zQW5kRnJhZ21lbnQuc2Vjb25kUGFydCxcbiAgICAgICAgICAgIHF1ZXJ5UGFyYW1zOiBVdGlsaXRpZXMuZ2V0UXVlcnlQYXJhbXNGcm9tU3RyaW5nKHVybEFuZFBhcmFtcy5zZWNvbmRQYXJ0KSxcbiAgICAgICAgICAgIHF1ZXJ5UGFyYW1zSGFuZGxpbmc6ICdtZXJnZSdcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLnJvdXRlci5uYXZpZ2F0ZShbdXJsQW5kUGFyYW1zLmZpcnN0UGFydF0sIG5hdmlnYXRpb25FeHRyYXMpO1xuICAgIH1cblxuICAgIHJlZGlyZWN0TG9nb3V0VXNlcigpIHtcbiAgICAgICAgY29uc3QgcmVkaXJlY3QgPSB0aGlzLmxvZ291dFJlZGlyZWN0VXJsID8gdGhpcy5sb2dvdXRSZWRpcmVjdFVybCA6IHRoaXMubG9naW5Vcmw7XG4gICAgICAgIHRoaXMubG9nb3V0UmVkaXJlY3RVcmwgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucm91dGVyLm5hdmlnYXRlKFtyZWRpcmVjdF0pO1xuICAgIH1cblxuICAgIHJlZGlyZWN0Rm9yTG9naW4ocmVkaXJlY3RVcmw/OiBzdHJpbmcpIHtcbiAgICAgICAgaWYgKHJlZGlyZWN0VXJsKSB7XG4gICAgICAgICAgICB0aGlzLmxvZ2luUmVkaXJlY3RVcmwgPSByZWRpcmVjdFVybDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubG9naW5SZWRpcmVjdFVybCA9IHRoaXMucm91dGVyLnVybDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJvdXRlci5uYXZpZ2F0ZShbdGhpcy5sb2dpblVybF0pO1xuICAgIH1cblxuICAgIHJlTG9naW4oKSB7XG4gICAgICAgIGlmICh0aGlzLnJlTG9naW5EZWxlZ2F0ZSkge1xuICAgICAgICAgICAgdGhpcy5yZUxvZ2luRGVsZWdhdGUoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucmVkaXJlY3RGb3JMb2dpbigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2lsbCBub3QgY2hhbmdlIHRoZSBzdGF0dXMgdGhhdCB3ZSBoYXZlIFxuICAgIHJlZnJlc2hMb2dpbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub2lkY0hlbHBlclNlcnZpY2UucmVmcmVzaExvZ2luKClcbiAgICAgICAgICAgIC5waXBlKG1hcChyZXNwID0+IHRoaXMucHJvY2Vzc0xvZ2luUmVzcG9uc2UocmVzcCwgdGhpcy5yZW1lbWJlck1lLCB0cnVlKSkpO1xuICAgIH1cblxuICAgIGxvZ2luV2l0aFBhc3N3b3JkKHVzZXJOYW1lOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcsIHJlbWVtYmVyTWU/OiBib29sZWFuKSB7XG4gICAgICAgIC8vIENsZWFuIHdoYXQgd2UgaGF2ZSBiZWZvcmUsIHdpdGhvdXQgZW1pdHRpbmcgYW55IGV2ZW50LiBcbiAgICAgICAgdGhpcy5sb2dvdXQodHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMub2lkY0hlbHBlclNlcnZpY2UubG9naW5XaXRoUGFzc3dvcmQodXNlck5hbWUsIHBhc3N3b3JkKVxuICAgICAgICAgICAgLnBpcGUobWFwKHJlc3AgPT4gdGhpcy5wcm9jZXNzTG9naW5SZXNwb25zZShyZXNwLCByZW1lbWJlck1lKSkpO1xuICAgIH1cblxuICAgIC8vIFNpbGVudCBldmVudCBpbiBjYXNlLlxuICAgIHByaXZhdGUgcHJvY2Vzc0xvZ2luUmVzcG9uc2UocmVzcG9uc2U6IExvZ2luUmVzcG9uc2UsIHJlbWVtYmVyTWU6IGJvb2xlYW4sIHNpbGVudEV2ZW50PzogYm9vbGVhbikge1xuICAgICAgICBjb25zdCBhY2Nlc3NUb2tlbiA9IHJlc3BvbnNlLmFjY2Vzc190b2tlbjtcblxuICAgICAgICBpZiAoYWNjZXNzVG9rZW4gPT0gbnVsbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhY2Nlc3NUb2tlbiBjYW5ub3QgYmUgbnVsbCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVtZW1iZXJNZSA9IHJlbWVtYmVyTWUgfHwgdGhpcy5yZW1lbWJlck1lO1xuXG4gICAgICAgIGNvbnN0IHJlZnJlc2hUb2tlbiA9IHJlc3BvbnNlLnJlZnJlc2hfdG9rZW4gfHwgdGhpcy5yZWZyZXNoVG9rZW47XG4gICAgICAgIGNvbnN0IGV4cGlyZXNJbiA9IHJlc3BvbnNlLmV4cGlyZXNfaW47XG4gICAgICAgIGNvbnN0IHRva2VuRXhwaXJ5RGF0ZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgIHRva2VuRXhwaXJ5RGF0ZS5zZXRTZWNvbmRzKHRva2VuRXhwaXJ5RGF0ZS5nZXRTZWNvbmRzKCkgKyBleHBpcmVzSW4pO1xuICAgICAgICBjb25zdCBhY2Nlc3NUb2tlbkV4cGlyeSA9IHRva2VuRXhwaXJ5RGF0ZTtcbiAgICAgICAgY29uc3Qgand0SGVscGVyID0gbmV3IEp3dEhlbHBlcigpO1xuICAgICAgICBjb25zdCBkZWNvZGVkQWNjZXNzVG9rZW4gPSBqd3RIZWxwZXIuZGVjb2RlVG9rZW4oYWNjZXNzVG9rZW4pIGFzIEFjY2Vzc1Rva2VuO1xuXG4gICAgICAgIGNvbnN0IHBlcm1pc3Npb25zOiBQZXJtaXNzaW9uVmFsdWVzW10gPSBBcnJheS5pc0FycmF5KGRlY29kZWRBY2Nlc3NUb2tlbi5wZXJtaXNzaW9uKSA/IGRlY29kZWRBY2Nlc3NUb2tlbi5wZXJtaXNzaW9uIDogW2RlY29kZWRBY2Nlc3NUb2tlbi5wZXJtaXNzaW9uXTtcblxuICAgICAgICBpZiAoIXRoaXMuaXNMb2dnZWRJbikge1xuICAgICAgICAgICAgdGhpcy5jb25maWd1cmF0aW9ucy5pbXBvcnQoZGVjb2RlZEFjY2Vzc1Rva2VuLmNvbmZpZ3VyYXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdXNlciA9IG5ldyBVc2VyKFxuICAgICAgICAgICAgZGVjb2RlZEFjY2Vzc1Rva2VuLnN1YixcbiAgICAgICAgICAgIGRlY29kZWRBY2Nlc3NUb2tlbi5uYW1lLFxuICAgICAgICAgICAgZGVjb2RlZEFjY2Vzc1Rva2VuLmZ1bGxuYW1lLFxuICAgICAgICAgICAgZGVjb2RlZEFjY2Vzc1Rva2VuLmVtYWlsLFxuICAgICAgICAgICAgZGVjb2RlZEFjY2Vzc1Rva2VuLmpvYnRpdGxlLFxuICAgICAgICAgICAgZGVjb2RlZEFjY2Vzc1Rva2VuLnBob25lX251bWJlcixcbiAgICAgICAgICAgIEFycmF5LmlzQXJyYXkoZGVjb2RlZEFjY2Vzc1Rva2VuLnJvbGUpID8gZGVjb2RlZEFjY2Vzc1Rva2VuLnJvbGUgOiBbZGVjb2RlZEFjY2Vzc1Rva2VuLnJvbGVdKTtcbiAgICAgICAgdXNlci5pc0VuYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuc2F2ZVVzZXJEZXRhaWxzKHVzZXIsIHBlcm1pc3Npb25zLCBhY2Nlc3NUb2tlbiwgcmVmcmVzaFRva2VuLCBhY2Nlc3NUb2tlbkV4cGlyeSwgcmVtZW1iZXJNZSk7XG5cbiAgICAgICAgaWYgKHNpbGVudEV2ZW50ICE9PSB0cnVlKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXRMb2dpblN0YXR1cyh1c2VyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB1c2VyO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2F2ZVVzZXJEZXRhaWxzKHVzZXI6IFVzZXIsIHBlcm1pc3Npb25zOiBQZXJtaXNzaW9uVmFsdWVzW10sIGFjY2Vzc1Rva2VuOiBzdHJpbmcsIHJlZnJlc2hUb2tlbjogc3RyaW5nLCBleHBpcmVzSW46IERhdGUsIHJlbWVtYmVyTWU6IGJvb2xlYW4pIHtcbiAgICAgICAgaWYgKHJlbWVtYmVyTWUpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNhdmVQZXJtYW5lbnREYXRhKGFjY2Vzc1Rva2VuLCBEQmtleXMuQUNDRVNTX1RPS0VOKTtcbiAgICAgICAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNhdmVQZXJtYW5lbnREYXRhKHJlZnJlc2hUb2tlbiwgREJrZXlzLlJFRlJFU0hfVE9LRU4pO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2F2ZVBlcm1hbmVudERhdGEoZXhwaXJlc0luLCBEQmtleXMuVE9LRU5fRVhQSVJFU19JTik7XG4gICAgICAgICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zYXZlUGVybWFuZW50RGF0YShwZXJtaXNzaW9ucywgREJrZXlzLlVTRVJfUEVSTUlTU0lPTlMpO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2F2ZVBlcm1hbmVudERhdGEodXNlciwgREJrZXlzLkNVUlJFTlRfVVNFUik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zYXZlU3luY2VkU2Vzc2lvbkRhdGEoYWNjZXNzVG9rZW4sIERCa2V5cy5BQ0NFU1NfVE9LRU4pO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2F2ZVN5bmNlZFNlc3Npb25EYXRhKHJlZnJlc2hUb2tlbiwgREJrZXlzLlJFRlJFU0hfVE9LRU4pO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2F2ZVN5bmNlZFNlc3Npb25EYXRhKGV4cGlyZXNJbiwgREJrZXlzLlRPS0VOX0VYUElSRVNfSU4pO1xuICAgICAgICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2F2ZVN5bmNlZFNlc3Npb25EYXRhKHBlcm1pc3Npb25zLCBEQmtleXMuVVNFUl9QRVJNSVNTSU9OUyk7XG4gICAgICAgICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zYXZlU3luY2VkU2Vzc2lvbkRhdGEodXNlciwgREJrZXlzLkNVUlJFTlRfVVNFUik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zYXZlUGVybWFuZW50RGF0YShyZW1lbWJlck1lLCBEQmtleXMuUkVNRU1CRVJfTUUpO1xuICAgIH1cblxuICAgIC8vIFNpbGllbnQgZXZlbnQgaW4gY2FzZS5cbiAgICBsb2dvdXQoc2lsZW50RXZlbnQ/OiBib29sZWFuKTogdm9pZCB7XG4gICAgICAgIHRoaXMubG9jYWxTdG9yYWdlLmRlbGV0ZURhdGEoREJrZXlzLkFDQ0VTU19UT0tFTik7XG4gICAgICAgIHRoaXMubG9jYWxTdG9yYWdlLmRlbGV0ZURhdGEoREJrZXlzLlJFRlJFU0hfVE9LRU4pO1xuICAgICAgICB0aGlzLmxvY2FsU3RvcmFnZS5kZWxldGVEYXRhKERCa2V5cy5UT0tFTl9FWFBJUkVTX0lOKTtcbiAgICAgICAgdGhpcy5sb2NhbFN0b3JhZ2UuZGVsZXRlRGF0YShEQmtleXMuVVNFUl9QRVJNSVNTSU9OUyk7XG4gICAgICAgIHRoaXMubG9jYWxTdG9yYWdlLmRlbGV0ZURhdGEoREJrZXlzLkNVUlJFTlRfVVNFUik7XG5cbiAgICAgICAgdGhpcy5jb25maWd1cmF0aW9ucy5jbGVhckxvY2FsQ2hhbmdlcygpO1xuXG4gICAgICAgIGlmIChzaWxlbnRFdmVudCAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgdGhpcy5lbWl0TG9naW5TdGF0dXMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZW1pdExvZ2luU3RhdHVzKGN1cnJlbnRVc2VyPzogVXNlcikge1xuICAgICAgICBjb25zdCB1c2VyID0gY3VycmVudFVzZXIgfHwgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0RGF0YU9iamVjdDxVc2VyPihEQmtleXMuQ1VSUkVOVF9VU0VSLCBmYWxzZSk7XG4gICAgICAgIGNvbnN0IGlzTG9nZ2VkSW4gPSB1c2VyICE9IG51bGw7XG4gICAgICAgIHRoaXMuX2xvZ2luU3RhdHVzLm5leHQoaXNMb2dnZWRJbik7XG4gICAgfVxuXG4gICAgZ2V0TG9naW5TdGF0dXNFdmVudCgpOiBPYnNlcnZhYmxlPGJvb2xlYW4+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvZ2luU3RhdHVzLmFzT2JzZXJ2YWJsZSgpO1xuICAgIH1cblxuICAgIGdldCBjdXJyZW50VXNlcigpOiBVc2VyIHtcbiAgICAgICAgY29uc3QgdXNlciA9IHRoaXMubG9jYWxTdG9yYWdlLmdldERhdGFPYmplY3Q8VXNlcj4oREJrZXlzLkNVUlJFTlRfVVNFUiwgZmFsc2UpO1xuICAgICAgICByZXR1cm4gdXNlcjtcbiAgICB9XG5cbiAgICBnZXQgdXNlclBlcm1pc3Npb25zKCk6IFBlcm1pc3Npb25WYWx1ZXNbXSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxvY2FsU3RvcmFnZS5nZXREYXRhT2JqZWN0PFBlcm1pc3Npb25WYWx1ZXNbXT4oREJrZXlzLlVTRVJfUEVSTUlTU0lPTlMsIGZhbHNlKSB8fCBbXTtcbiAgICB9XG5cbiAgICBnZXQgYWNjZXNzVG9rZW4oKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub2lkY0hlbHBlclNlcnZpY2UuYWNjZXNzVG9rZW47XG4gICAgfVxuXG4gICAgZ2V0IGFjY2Vzc1Rva2VuRXhwaXJ5RGF0ZSgpOiBEYXRlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub2lkY0hlbHBlclNlcnZpY2UuYWNjZXNzVG9rZW5FeHBpcnlEYXRlO1xuICAgIH1cblxuICAgIGdldCByZWZyZXNoVG9rZW4oKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub2lkY0hlbHBlclNlcnZpY2UucmVmcmVzaFRva2VuO1xuICAgIH1cblxuICAgIGdldCBpc1Nlc3Npb25FeHBpcmVkKCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5vaWRjSGVscGVyU2VydmljZS5pc1Nlc3Npb25FeHBpcmVkO1xuICAgIH1cblxuICAgIGdldCBpc0xvZ2dlZEluKCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXJyZW50VXNlciAhPSBudWxsO1xuICAgIH1cblxuICAgIGdldCByZW1lbWJlck1lKCk6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0RGF0YU9iamVjdDxib29sZWFuPihEQmtleXMuUkVNRU1CRVJfTUUsIGZhbHNlKSA9PSB0cnVlO1xuICAgIH1cbn1cbiJdfQ==