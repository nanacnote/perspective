/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import * as d3 from "d3";
import {enforceContainerBoundaries} from "./enforceContainerBoundaries";

const horizontalHandleClass = "horizontal-drag-handle";
const verticalHandleClass = "vertical-drag-handle";
const cornerHandleClass = "corner-drag-handle";

const handlesContainerId = "dragHandles";

const fillOpacity = 0.0;

export function resizableComponent() {
    let handleWidthPx = 9;
    let zIndex = 3;
    const minDimensionsPx = {height: 100, width: 100};

    const callbackFuncs = [];
    const executeCallbacks = direction => {
        callbackFuncs.forEach(func => {
            func(direction);
        });
    };

    const resizable = container => {
        if (handlesContainerExists(container)) {
            return;
        }

        const dragHelper = {
            left: () => executeCallbacks({horizontal: dragLeft(d3.event), vertical: false}),
            top: () => executeCallbacks({horizontal: false, vertical: dragTop(d3.event)}),
            right: () => executeCallbacks({horizontal: dragRight(d3.event), vertical: false}),
            bottom: () => executeCallbacks({horizontal: false, vertical: dragBottom(d3.event)}),

            topleft: () => executeCallbacks({horizontal: dragLeft(d3.event), vertical: dragTop(d3.event)}),
            topright: () => executeCallbacks({horizontal: dragRight(d3.event), vertical: dragTop(d3.event)}),
            bottomright: () => executeCallbacks({horizontal: dragRight(d3.event), vertical: dragBottom(d3.event)}),
            bottomleft: () => executeCallbacks({horizontal: dragLeft(d3.event), vertical: dragBottom(d3.event)})
        };

        const containerNode = container.node();
        const containerRect = containerNode.getBoundingClientRect();
        const handles = container
            .append("svg")
            .attr("id", handlesContainerId)
            .attr("width", containerRect.width)
            .attr("height", containerRect.height);
        const handlesGroup = handles.append("g");

        const isVertical = d => {
            return d === "left" || d === "right";
        };
        const xCoordHelper = {left: 0, top: handleWidthPx, right: containerRect.width - handleWidthPx, bottom: handleWidthPx};
        const yCoordHelper = {left: handleWidthPx, top: 0, right: handleWidthPx, bottom: containerRect.height - handleWidthPx};
        const edgeHandles = ["left", "top", "right", "bottom"];
        const [leftHandle, topHandle, rightHandle, bottomHandle] = edgeHandles.map(edge =>
            handlesGroup
                .append("rect")
                .attr("id", `drag${edge}`)
                .attr("class", isVertical(edge) ? verticalHandleClass : horizontalHandleClass)
                .attr("y", yCoordHelper[edge])
                .attr("x", xCoordHelper[edge])
                .attr("height", isVertical(edge) ? containerRect.height - handleWidthPx * 2 : handleWidthPx)
                .attr("width", isVertical(edge) ? handleWidthPx : containerRect.width - handleWidthPx * 2)
                .attr("fill", isVertical(edge) ? "lightgreen" : "lightblue")
                .attr("fill-opacity", fillOpacity)
                .style("z-index", zIndex)
                .attr("cursor", isVertical(edge) ? "ew-resize" : "ns-resize")
                .call(d3.drag().on("drag", dragHelper[edge]))
        );

        const concatCornerEdges = corner => `${corner[0]}${corner[1]}`;
        const cornerCursorHelper = {topleft: "nwse", topright: "nesw", bottomright: "nwse", bottomleft: "nesw"};
        const cornerHandles = [["top", "left"], ["top", "right"], ["bottom", "right"], ["bottom", "left"]];
        const [topLeftHandle, topRightHandle, bottomRightHandle, bottomLeftHandle] = cornerHandles.map(corner =>
            handlesGroup
                .append("rect")
                .attr("id", `drag${concatCornerEdges(corner)}`)
                .attr("class", `${cornerHandleClass} ${corner[0]} ${corner[1]}`)
                .attr("height", handleWidthPx)
                .attr("width", handleWidthPx)
                .attr("fill", "red")
                .attr("fill-opacity", fillOpacity)
                .style("z-index", zIndex)
                .attr("cursor", `${cornerCursorHelper[concatCornerEdges(corner)]}-resize`)
                .call(d3.drag().on("drag", dragHelper[concatCornerEdges(corner)]))
        );

        pinCorners(handles);

        function dragLeft(event) {
            const offset = enforceMinDistToParallelBar(enforceContainerBoundaries(leftHandle.node(), event.x, 0).x, handles, "width", (x, y) => x - y);
            containerNode.style.left = `${containerNode.offsetLeft + offset}px`;
            containerNode.style.width = `${containerNode.offsetWidth - offset}px`;
            return resizeAndRelocateHandles(rightHandle, offset, "width", "x");
        }

        function dragRight(event) {
            const offset = -enforceMinDistToParallelBar(enforceContainerBoundaries(rightHandle.node(), event.dx, 0).x, handles, "width", (x, y) => x + y);
            if (pointerFallenBehindAbsoluteCoordinates(offset, "x", rightHandle, event)) return false;
            containerNode.style.width = `${containerNode.offsetWidth - offset}px`;
            return resizeAndRelocateHandles(rightHandle, offset, "width", "x");
        }

        function dragTop(event) {
            const offset = enforceMinDistToParallelBar(enforceContainerBoundaries(topHandle.node(), 0, event.y).y, handles, "height", (x, y) => x - y);
            containerNode.style.top = `${containerNode.offsetTop + offset}px`;
            containerNode.style.height = `${containerNode.offsetHeight - offset}px`;
            return resizeAndRelocateHandles(bottomHandle, offset, "height", "y");
        }

        function dragBottom(event) {
            const offset = -enforceMinDistToParallelBar(enforceContainerBoundaries(bottomHandle.node(), 0, event.dy).y, handles, "height", (x, y) => x + y);
            if (pointerFallenBehindAbsoluteCoordinates(offset, "y", bottomHandle, event)) return false;
            containerNode.style.height = `${containerNode.offsetHeight - offset}px`;
            return resizeAndRelocateHandles(bottomHandle, offset, "height", "y");
        }

        function resizeAndRelocateHandles(handle, offset, dimension, axis) {
            extendHandlesBox(handles, dimension, offset);
            pinHandleToHandleBoxEdge(handle, axis, offset);
            extendPerpendicularHandles(handles, offset, dimension, dimension === "height" ? verticalHandleClass : horizontalHandleClass);
            pinCorners(handles);
            return offset != 0;
        }

        function pinCorners(handles) {
            topLeftHandle.attr("y", 0, "x", 0);
            topRightHandle.attr("y", 0).attr("x", handles.attr("width") - handleWidthPx);
            bottomRightHandle.attr("y", handles.attr("height") - handleWidthPx).attr("x", handles.attr("width") - handleWidthPx);
            bottomLeftHandle.attr("y", handles.attr("height") - handleWidthPx).attr("x", 0);
        }
    };

    resizable.addCallbackToResize = func => {
        callbackFuncs.push(func);
        return resizable;
    };

    resizable.zIndex = input => {
        zIndex = input;
        return resizable;
    };

    resizable.minWidth = input => {
        minDimensionsPx.width = input;
        return resizable;
    };

    resizable.minHeight = input => {
        minDimensionsPx.height = input;
        return resizable;
    };

    resizable.handleWidth = input => {
        handleWidthPx = input;
        return resizable;
    };

    function pointerFallenBehindAbsoluteCoordinates(offset, axis, handle, event) {
        const becauseCrossedMinSize = (offset, axis, handle, event) => offset < 0 && event[axis] < Number(handle.attr(axis));
        const becauseExitedCoordinateSpace = (offset, axis, handle, event) => offset > 0 && event[axis] > Number(handle.attr(axis));
        return becauseCrossedMinSize(offset, axis, handle, event) || becauseExitedCoordinateSpace(offset, axis, handle, event);
    }

    function enforceMinDistToParallelBar(offset, dragHandleContainer, dimension, operatorFunction) {
        const anticipatedDimension = operatorFunction(Number(dragHandleContainer.attr(dimension)), offset);
        if (anticipatedDimension < minDimensionsPx[dimension]) {
            const difference = minDimensionsPx[dimension] - anticipatedDimension;
            return operatorFunction(offset, difference);
        }
        return offset;
    }

    return resizable;
}

function handlesContainerExists(container) {
    let handlesContainer = container.select(`#${handlesContainerId}`);
    return handlesContainer.size() > 0;
}

// "dimension" referring to width or height
function extendPerpendicularHandles(handles, offset, dimension, orientationClass) {
    const perpendicularHandles = handles.selectAll(`.${orientationClass}`);
    perpendicularHandles.each((_, i, nodes) => {
        const handleNode = nodes[i];
        const handleElement = d3.select(handleNode);
        handleElement.attr(dimension, handleNode.getBoundingClientRect()[dimension] - offset);
    });
}

function pinHandleToHandleBoxEdge(handle, axis, offset) {
    handle.attr(axis, Number(handle.attr(axis)) - offset);
}

function extendHandlesBox(handles, dimension, offset) {
    handles.attr(dimension, handles.node().getBoundingClientRect()[dimension] - offset);
}
