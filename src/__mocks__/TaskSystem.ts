import {MockedTaskSystem} from "../TaskSystems/MockedTaskSystem";

let mock = new MockedTaskSystem();
export const setTaskSystem = jest.fn();
export const currentTaskSystem = jest.fn().mockImplementation(() => mock);