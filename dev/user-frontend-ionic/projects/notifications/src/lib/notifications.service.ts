import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { FirebaseMessaging, GetTokenOptions } from '@capacitor-firebase/messaging';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { Platform } from '@ionic/angular';
import { getAuthToken } from '@ul/shared';
import { combineLatest, Observable, of } from 'rxjs';
import { filter, first, switchMap, tap } from 'rxjs/operators';
import { Channel, Notification, NotificationsRepository } from './notifications.repository';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {

  constructor(
    @Inject('environment')
    private environment: any,
    private http: HttpClient,
    public notificationRepository: NotificationsRepository,
    private platform: Platform
  ) {
  }

  public getNotifications(authToken: string, offset: number, length: number): Observable<Notification[]> {
    const url = `${this.environment.apiEndpoint}/notifications`;
    const data = {
      authToken,
      offset,
      length
    };

    return this.http.post<Notification[]>(url, data);
  }

  public loadAndStoreChannels(): Observable<Channel[]> {
    const url = `${this.environment.apiEndpoint}/notifications/channels`;

    return this.http.get<Channel[]>(url).pipe(
      tap((channels) => {
        this.notificationRepository.setChannels(channels);
      }));
  }

  public loadNotifications(offset: number, length: number): Observable<Notification[]> {
    return getAuthToken().pipe(
      filter(authToken => authToken != null),
      switchMap(authToken => this.getNotifications(authToken, offset, length)),
      tap((notifications) => {
        if (offset === 0) {
          this.notificationRepository.setNotifications(notifications);
        } else {
          this.notificationRepository.addNotifications(notifications);
        }
      })
    );
  }

  public deleteNotification(id: string) {
    return getAuthToken().pipe(
      first(),
      filter(authToken => authToken != null),
      switchMap(authToken => this.removeNotification(authToken, id)),
    );
  }

  public loadAndStoreUnsubscribedChannels(): Observable<string[]> {
    return getAuthToken().pipe(
      filter(authToken => authToken != null),
      switchMap(authToken => {
        const url = `${this.environment.apiEndpoint}/notifications/unsubscribed-channels`;
        const data = {
          authToken
        };

        return this.http.post<string[]>(url, data);
      }),
      tap((userChannels) => {
        this.notificationRepository.setUnsubscribedChannels(userChannels);
      }
      ));
  }

  public subscribeOrUnsubscribeUserToChannels(options: { channelCodes: string[] }): Observable<any> {
    return getAuthToken().pipe(
      filter(authToken => authToken != null),
      switchMap(authToken => {
        const url = `${this.environment.apiEndpoint}/notifications/channels`;
        const data = {
          authToken,
          channelCodes: options.channelCodes,
        };

        return this.http.patch(url, data);
      }
      ));
  }

  public markUnreadNotificationsAsRead(notificationIds: string[]): Observable<void> {
    return getAuthToken().pipe(
      // On ne balance la requête au serveur que si la liste des notifications à marquer comme lues n'est pas vide
      filter(authToken => authToken != null && notificationIds.length > 0),
      switchMap(authToken => {
        const url = `${this.environment.apiEndpoint}/notifications/read`;
        const data = {
          authToken,
          notificationIds
        };

        return this.http.post<void>(url, data);
      })
    );
  }

  public async saveFCMToken() {
    this.registerPushNotifications();
    combineLatest([getAuthToken(), this.notificationRepository.fcmToken$])
      .pipe(
        filter(([authToken, fcmToken]) => !!fcmToken),
        first(),
        switchMap(([authToken, fcmToken]) => {
          const url = `${this.environment.apiEndpoint}/notifications/register`;
          const data = {
            authToken,
            token: fcmToken.value,
            platform: this.platform.platforms().join(',')
          };
          return this.http.post(url, data);
        })
      )
      .subscribe(res => res);

  }

  public async unregisterFCMToken(authToken: string) {
    if (!authToken) {
      return;
    }
    this.notificationRepository.fcmToken$
      .pipe(
        first(),
        switchMap((fcmToken) => {
          if (!fcmToken) {
            return of(null);
          }
          const url = `${this.environment.apiEndpoint}/notifications/unregister`;
          const data = {
            authToken,
            fcmToken: fcmToken.value,
          };
          return this.http.post(url, data);
        })
      )
      .subscribe(res => {
        this.deleteFCMToken();
        return;
      });
}

  public async deleteFCMToken() {
    this.notificationRepository.clearNotifications();
  }

  private removeNotification(authToken: string, notificationId: string) {
    const url = `${this.environment.apiEndpoint}/notifications/delete`;
    const data = {
      authToken,
      notificationId
    };

    return this.http.delete(url, { body: data });
  }

  private registerPushNotifications() {
    if (!this.platform.is('capacitor')) { // Web
      FirebaseMessaging.requestPermissions();

      const options: GetTokenOptions = {
        vapidKey: this.environment.firebase.vapidKey,
      };

      navigator.serviceWorker.register('firebase-messaging-sw.js').then(registration => {
        options.serviceWorkerRegistration = registration;
        FirebaseMessaging.getToken(options).then(tokenResult => {
          // NOTE: when the user resets the notifications authorisation and wants to allow it again, this will trigger
          // a 404 error from firebase followed by this message in the console: "FirebaseError: Messaging: A problem
          // occured while unsubscribing the user from FCM", it has been reported since 2019 in this thread but hasn't
          // been solved since: https://github.com/firebase/firebase-js-sdk/issues/2364
          // It could be fixed by firebase in a future release
          this.notificationRepository.setFcmToken({ value: tokenResult.token });
        });
      });
    } else { // Mobile
      PushNotifications.requestPermissions().then(result => {
        if (result.receive === 'granted') {
          PushNotifications.register();
        }
      });

      PushNotifications.addListener('registration',
        (token: Token) => {
          this.notificationRepository.setFcmToken(token);
        }
      );
    }
  }
}
