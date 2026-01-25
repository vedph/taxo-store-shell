import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreeStorePicker } from './tree-store-picker';

describe('TreeStorePicker', () => {
  let component: TreeStorePicker;
  let fixture: ComponentFixture<TreeStorePicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeStorePicker]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TreeStorePicker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
