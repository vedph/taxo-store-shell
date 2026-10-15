import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  function submitForm(): Event {
    const event = new Event('submit', { cancelable: true });
    (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(event);
    return event;
  }

  function resetRequests() {
    return TestBed.inject(HttpTestingController).match((r) =>
      r.url.endsWith('accounts/resetpassword/request'),
    );
  }

  it('should request a reset on submit with a valid email', async () => {
    component.form.email().value.set('a@b.org');
    const event = submitForm();
    expect(event.defaultPrevented).toBe(true);
    const requests = resetRequests();
    expect(requests.length).toBe(1);
    expect(requests[0].request.body).toEqual({ email: 'a@b.org' });
    expect(component.busy()).toBe(true);
    requests[0].flush({});
    await fixture.whenStable();
    expect(component.busy()).toBe(false);
  });

  it('should not request a reset with an invalid email, showing errors', async () => {
    component.form.email().value.set('not-an-email');
    submitForm();
    expect(resetRequests().length).toBe(0);
    await fixture.whenStable();
    const errors = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('mat-error'),
    ).map((e) => e.textContent?.trim());
    expect(errors).toEqual(['invalid email address']);
  });

  it('should not request a reset without email', async () => {
    submitForm();
    expect(resetRequests().length).toBe(0);
    await fixture.whenStable();
    const errors = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('mat-error'),
    ).map((e) => e.textContent?.trim());
    expect(errors).toEqual(['email address required']);
  });
});
